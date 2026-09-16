package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

type ConnectionManager struct {
	container      *sqlstore.Container
	client         *whatsmeow.Client
	wsClient       *WSClient
	whatsappStatus WhatsAppStatus
	sessionStatus  SessionStatus
	jobRunner      *JobRunner
	ctx            context.Context
	cancel         context.CancelFunc
	mu             sync.RWMutex
	connecting     bool
	qrVersion      int
}

func NewConnectionManager(container *sqlstore.Container, wClient *whatsmeow.Client, wsClient *WSClient, jobRunner *JobRunner) *ConnectionManager {
	ctx, cancel := context.WithCancel(context.Background())
	return &ConnectionManager{
		container:      container,
		client:         wClient,
		wsClient:       wsClient,
		jobRunner:      jobRunner,
		whatsappStatus: StatusStarting,
		sessionStatus:  SessionNone,
		ctx:            ctx,
		cancel:         cancel,
		qrVersion:      0,
	}
}

func (cm *ConnectionManager) GetClient() *whatsmeow.Client {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.client
}

func (cm *ConnectionManager) resetClientLocked() {
	if cm.client != nil && cm.client.IsConnected() {
		cm.client.Disconnect()
	}

	if cm.container == nil {
		log.Println("[WA] ERRO CRÍTICO: Container de banco de dados não configurado no ConnectionManager.")
		return
	}

	newDevice := cm.container.NewDevice()
	newClient := whatsmeow.NewClient(newDevice, nil)
	newClient.AddEventHandler(cm.eventHandler)
	cm.client = newClient
	log.Println("[WA] Novo whatsmeow.Client criado com sucesso com Device limpo.")
}

func (cm *ConnectionManager) Start() {
	cm.mu.Lock()
	if cm.client != nil && cm.client.Store != nil && !cm.client.Store.Deleted && cm.client.Store.ID != nil {
		cm.sessionStatus = SessionValid
		cm.whatsappStatus = StatusReconnecting
	} else {
		cm.sessionStatus = SessionNone
		cm.whatsappStatus = StatusNoSession
	}
	cm.mu.Unlock()

	if cm.client != nil {
		cm.client.AddEventHandler(cm.eventHandler)
	}
	cm.wsClient.OnMessage = cm.handleServerMessage
	cm.wsClient.Start()

	go cm.heartbeatLoop()
}

func (cm *ConnectionManager) handleServerMessage(msgData []byte) {
	var base IncomingMessage
	if err := json.Unmarshal(msgData, &base); err != nil {
		return
	}

	switch base.Type {
	case "SEND_JOB":
		var job SendJobMsg
		if err := json.Unmarshal(msgData, &job); err == nil {
			cm.jobRunner.Enqueue(job)
		}
	case "SYNC_RESPONSE":
		var sync SyncResponseMsg
		if err := json.Unmarshal(msgData, &sync); err == nil {
			for _, job := range sync.PendingJobs {
				cm.jobRunner.Enqueue(job)
			}
		}
	case "PAUSE":
		cm.jobRunner.Pause()
	case "RESUME":
		cm.jobRunner.Resume()
	case "SYNC_GROUPS":
		log.Println("[WA] Comando SYNC_GROUPS recebido do Coordinator...")
		go cm.SyncGroupsToCoordinator()
	case "RESTART_WA":
		log.Println("[WA] Comando RESTART_WA recebido. Forçando emissão de novo QR...")
		go cm.forceRestartWhatsApp()
	case "CONNECT_WA":
		// Solicitação explícita do usuário para iniciar conexão/pareamento.
		log.Println("[WA] Comando CONNECT_WA recebido. Iniciando conexão WhatsApp...")
		go cm.connectWhatsApp()
	case "AGENT_ACCEPTED":
		// Agent foi aceito pelo Durable Object.
		// Se já existe sessão salva no SQLite, reconectar automaticamente (comportamento esperado).
		// Se NÃO há sessão, apenas reportar estado e aguardar CONNECT_WA explícito do usuário.
		cm.mu.RLock()
		hasSavedSession := cm.client != nil && cm.client.Store != nil && !cm.client.Store.Deleted && cm.client.Store.ID != nil
		cm.mu.RUnlock()

		if hasSavedSession {
			log.Println("[WA] Agent aceito. Sessão existente detectada — reconectando automaticamente...")
			go cm.connectWhatsApp()
		} else {
			log.Println("[WA] Agent aceito. Nenhuma sessão existente — aguardando CONNECT_WA do usuário.")
			cm.updateStatus(StatusNoSession, "")
		}
	}
}

func (cm *ConnectionManager) forceRestartWhatsApp() {
	cm.mu.Lock()
	log.Println("[WA] Forçando reinicialização do WhatsApp para novo pareamento...")

	if cm.client != nil && cm.client.IsConnected() {
		cm.client.Disconnect()
	}

	// Deleta todas as sessões existentes no SQLite para garantir pareamento novo e limpo
	if cm.container != nil {
		devices, err := cm.container.GetAllDevices(context.Background())
		if err == nil {
			for _, dev := range devices {
				if !dev.Deleted {
					if err := dev.Delete(context.Background()); err != nil {
						log.Printf("[WA] Erro ao deletar dispositivo do container: %v", err)
					}
				}
			}
			log.Println("[WA] Todos os dispositivos anteriores removidos do banco.")
		}
	} else if cm.client != nil && cm.client.Store != nil && !cm.client.Store.Deleted {
		if err := cm.client.Store.Delete(context.Background()); err != nil {
			log.Printf("[WA] Erro ao limpar device store no restart: %v", err)
		} else {
			log.Println("[WA] Device store limpo com sucesso para novo pareamento.")
		}
	}

	// Cria novo Device e novo whatsmeow.Client limpos imediatamente
	cm.resetClientLocked()

	cm.whatsappStatus = StatusNoSession
	cm.sessionStatus = SessionNone
	cm.qrVersion = 0
	cm.mu.Unlock()

	// Aguardar brevemente desconexão de rede
	time.Sleep(200 * time.Millisecond)
	cm.connectWhatsApp()
}

func (cm *ConnectionManager) connectWhatsApp() {
	cm.mu.Lock()
	// Se o cliente estiver nulo, sem store ou com store marcado como deletado, recriar imediatamente
	if cm.client == nil || cm.client.Store == nil || cm.client.Store.Deleted {
		log.Println("[WA] Cliente ausente ou dispositivo marcado como deletado. Recriando cliente WhatsApp...")
		cm.resetClientLocked()
		cm.sessionStatus = SessionNone
		cm.whatsappStatus = StatusNoSession
	}

	if cm.client.IsConnected() {
		cm.whatsappStatus = StatusConnected
		cm.sessionStatus = SessionValid
		cm.sendStatusMessageLocked("")
		cm.mu.Unlock()
		go cm.SyncGroupsToCoordinator()
		return
	}
	if cm.connecting {
		cm.mu.Unlock()
		return
	}
	cm.connecting = true
	cm.mu.Unlock()

	defer func() {
		cm.mu.Lock()
		cm.connecting = false
		cm.mu.Unlock()
	}()

	cm.mu.RLock()
	sStatus := cm.sessionStatus
	hasStoreSession := cm.client != nil && cm.client.Store != nil && !cm.client.Store.Deleted && cm.client.Store.ID != nil
	cm.mu.RUnlock()

	// Se não existe ID salvo no SQLite store, a sessão é obrigatoriamente SessionNone
	if !hasStoreSession {
		sStatus = SessionNone
	}

	if sStatus == SessionNone {
		log.Println("[WA] Solicitando novo QR Code...")

		// Criamos um contexto com timeout para a rotina de QR
		qrCtx, qrCancel := context.WithTimeout(cm.ctx, 3*time.Minute)

		log.Println("[WA] Chamando GetQRChannel()...")

		qrChan, err := cm.client.GetQRChannel(qrCtx)
		if err != nil {
			qrCancel()
			log.Printf("[WA] GetQRChannel() ERRO: %v", err)
			cm.updateStatus(StatusError, "Falha ao gerar QR Code: "+err.Error())
			return
		}

		log.Println("[WA] GetQRChannel() OK")
		log.Println("[WA] Chamando Connect()...")

		// Goroutine responsável por ler todos os frames de QR enquanto o canal estiver aberto.
		// O qrCancel DEVE ser executado aqui quando a leitura terminar, NUNCA no defer de connectWhatsApp()!
		go func() {
			defer qrCancel()
			log.Println("[WA] Iniciando leitura do QR Channel...")

			for evt := range qrChan {
				log.Printf(
					"[WA] QR EVENT: event=%q code_length=%d",
					evt.Event,
					len(evt.Code),
				)

				switch evt.Event {
				case "code":
					cm.mu.Lock()
					cm.qrVersion++
					version := cm.qrVersion
					cm.whatsappStatus = StatusWaitingQR
					cm.mu.Unlock()

					qrHash := HashQR(evt.Code)
					expiresDuration := evt.Timeout
					if expiresDuration <= 0 {
						expiresDuration = 20 * time.Second
					}
					expiresAt := time.Now().Add(expiresDuration).Format(time.RFC3339)

					log.Printf("[WA] *** QR CODE GERADO *** -> Versao=%d, Hash=%s, Tamanho=%d, ExpiraEm=%v",
						version, qrHash, len(evt.Code), expiresDuration)

					qrMsg := QrUpdateMsg{
						BaseMessage: fillBase("QR_UPDATE", randomID),
						AgentID:     cm.wsClient.agentID,
						QRCode:      evt.Code,
						QRVersion:   version,
						GeneratedAt: time.Now().UTC().Format(time.RFC3339),
						ExpiresAt:   expiresAt,
					}

					if err := cm.wsClient.Send(qrMsg); err != nil {
						log.Printf("[WA] Erro ao enviar QR ao DO: %v", err)
					}

				case "success":
					log.Println("[WA] *** QR AUTENTICADO COM SUCESSO ***")
					cm.mu.Lock()
					cm.sessionStatus = SessionValid
					cm.whatsappStatus = StatusConnected
					cm.sendStatusMessageLocked("")
					cm.mu.Unlock()
					go cm.SyncGroupsToCoordinator()
					return

				case "timeout":
					log.Println("[WA] *** QR TIMEOUT (Validade expirada pelo WhatsApp) ***")
					cm.updateStatus(StatusDisconnected, "QR Code expirou. Solicite um novo.")
					return

				default:
					log.Printf("[WA] *** EVENTO FINAL/ERRO DO QR: %q ***", evt.Event)
					if evt.Error != nil {
						cm.updateStatus(StatusError, "Erro no QR: "+evt.Error.Error())
					}
				}
			}

			log.Println("[WA] QR Channel encerrado.")
		}()

		err = cm.client.Connect()
		if err != nil {
			qrCancel()
			log.Printf("[WA] Connect() ERRO: %v", err)
			cm.updateStatus(StatusError, "Erro de conexao: "+err.Error())
			return
		}

		log.Println("[WA] Connect() OK")

	} else {
		log.Println("[WA] Reconectando sessão existente...")

		err := cm.client.Connect()
		if err != nil {
			log.Printf("[WA] Erro na reconexão: %v", err)
			cm.updateStatus(StatusError, err.Error())
			return
		}

		log.Println("[WA] Reconexão OK")
	}
}

func (cm *ConnectionManager) eventHandler(evt interface{}) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	switch v := evt.(type) {
	case *events.Connected:
		log.Println("[WA EVENT] Connected")

		cm.sessionStatus = SessionValid
		cm.whatsappStatus = StatusConnected
		cm.sendStatusMessageLocked("")

	case *events.Disconnected:
		log.Println("[WA EVENT] Disconnected")

		cm.whatsappStatus = StatusDisconnected
		cm.sendStatusMessageLocked("")

	case *events.LoggedOut:
		log.Println("[WA EVENT] LoggedOut")

		if cm.container != nil {
			devices, err := cm.container.GetAllDevices(context.Background())
			if err == nil {
				for _, dev := range devices {
					if !dev.Deleted {
						_ = dev.Delete(context.Background())
					}
				}
			}
		} else if cm.client != nil && cm.client.Store != nil && !cm.client.Store.Deleted {
			_ = cm.client.Store.Delete(context.Background())
		}

		// Recria cliente limpo imediatamente para o próximo CONNECT_WA
		cm.resetClientLocked()

		cm.sessionStatus = SessionNone
		cm.whatsappStatus = StatusNoSession
		cm.sendStatusMessageLocked("Logged out from another device")

	case *events.ConnectFailure:
		log.Printf("[WA EVENT] ConnectFailure: %+v", v)

		cm.whatsappStatus = StatusError
		cm.sendStatusMessageLocked(fmt.Sprintf("Connect failure: %v", v.Reason))

	default:
		log.Printf("[WA EVENT] Evento: %T", evt)
	}
}

func (cm *ConnectionManager) updateStatus(waStatus WhatsAppStatus, errStr string) {
	cm.mu.Lock()
	cm.whatsappStatus = waStatus
	cm.sendStatusMessageLocked(errStr)
	cm.mu.Unlock()
}

// Método auxiliar interno que assume que cm.mu já está travado
func (cm *ConnectionManager) sendStatusMessageLocked(errStr string) {
	msg := StatusUpdateMsg{
		BaseMessage:    fillBase("STATUS_UPDATE", randomID),
		AgentID:        cm.wsClient.agentID,
		WhatsAppStatus: cm.whatsappStatus,
		SessionStatus:  cm.sessionStatus,
		LastError:      errStr,
	}
	cm.wsClient.Send(msg)
}

func (cm *ConnectionManager) Status() map[string]string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return map[string]string{
		"whatsappStatus": string(cm.whatsappStatus),
		"sessionStatus":  string(cm.sessionStatus),
	}
}

func (cm *ConnectionManager) heartbeatLoop() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			cm.mu.RLock()
			wStatus := cm.whatsappStatus
			sStatus := cm.sessionStatus
			cm.mu.RUnlock()

			cm.wsClient.Send(HeartbeatMsg{
				BaseMessage:    fillBase("HEARTBEAT", randomID),
				AgentID:        cm.wsClient.agentID,
				WhatsAppStatus: wStatus,
				SessionStatus:  sStatus,
			})
		case <-cm.ctx.Done():
			return
		}
	}
}

func (cm *ConnectionManager) Stop() {
	cm.cancel()
	cm.mu.RLock()
	cli := cm.client
	cm.mu.RUnlock()
	if cli != nil {
		cli.Disconnect()
	}
}

func (cm *ConnectionManager) SyncGroupsToCoordinator() {
	cli := cm.GetClient()
	if cli == nil || !cli.IsConnected() {
		log.Println("[WA] SyncGroupsToCoordinator: WhatsApp ainda não está conectado no whatsmeow.")
		return
	}

	var destinations []ChannelDestination

	// Grupos e Comunidades com timeout próprio de 10s
	groupsCtx, groupsCancel := context.WithTimeout(context.Background(), 10*time.Second)
	groups, err := cli.GetJoinedGroups(groupsCtx)
	groupsCancel()
	if err == nil {
		for _, g := range groups {
			destType := "group"
			if g.IsParent {
				destType = "community"
			}
			destinations = append(destinations, ChannelDestination{
				JID:  g.JID.String(),
				Name: g.Name,
				Type: destType,
			})
		}
	} else {
		log.Printf("[WA] Erro ao listar grupos: %v", err)
	}

	// Newsletters com timeout curto próprio de 5s
	newsCtx, newsCancel := context.WithTimeout(context.Background(), 5*time.Second)
	newsletters, err := cli.GetSubscribedNewsletters(newsCtx)
	newsCancel()
	if err == nil {
		for _, n := range newsletters {
			destinations = append(destinations, ChannelDestination{
				JID:  n.ID.String(),
				Name: n.ThreadMeta.Name.Text,
				Type: "newsletter",
			})
		}
	} else {
		log.Printf("[WA] Newsletters: %v (normal se a conta não tiver canal criado)", err)
	}

	// Contatos individuais sincronizados do WhatsApp
	if cli.Store != nil && cli.Store.Contacts != nil {
		contactsCtx, contactsCancel := context.WithTimeout(context.Background(), 5*time.Second)
		contacts, err := cli.Store.Contacts.GetAllContacts(contactsCtx)
		contactsCancel()
		if err == nil && len(contacts) > 0 {
			seenContacts := make(map[string]bool)
			var contactList []ChannelDestination
			for jid, info := range contacts {
				if jid.Server != types.DefaultUserServer {
					continue
				}
				userJid := types.NewJID(jid.User, types.DefaultUserServer)
				if seenContacts[userJid.String()] {
					continue
				}
				seenContacts[userJid.String()] = true

				name := strings.TrimSpace(info.FullName)
				if name == "" {
					name = strings.TrimSpace(info.FirstName)
				}
				if name == "" {
					name = strings.TrimSpace(info.BusinessName)
				}
				if name == "" {
					name = strings.TrimSpace(info.PushName)
				}
				if name == "" {
					name = "+" + userJid.User
				} else {
					name = fmt.Sprintf("%s (+%s)", name, userJid.User)
				}
				contactList = append(contactList, ChannelDestination{
					JID:  userJid.String(),
					Name: name,
					Type: "contact",
				})
			}
			if len(contactList) > 100 {
				contactList = contactList[:100]
			}
			destinations = append(destinations, contactList...)
		}
	}

	log.Printf("[WA] Sincronizando %d grupos/canais com o Cloudflare Coordinator...", len(destinations))
	for _, d := range destinations {
		log.Printf("  -> [%s] %s (%s)", d.Type, d.Name, d.JID)
	}

	msg := ChannelsUpdateMsg{
		BaseMessage: fillBase("CHANNELS_UPDATE", randomID),
		AgentID:     cm.wsClient.agentID,
		Channels:    destinations,
	}
	if err := cm.wsClient.Send(msg); err != nil {
		log.Printf("[WA] Erro ao enviar CHANNELS_UPDATE para o DO: %v", err)
	} else {
		log.Printf("[WA] %d canais enviados com sucesso para o DO!", len(destinations))
	}
}
