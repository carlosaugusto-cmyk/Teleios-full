package agent

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types/events"
)

type ConnectionManager struct {
	client         *whatsmeow.Client
	wsClient       *WSClient
	whatsappStatus WhatsAppStatus
	sessionStatus  SessionStatus
	jobRunner      *JobRunner
	ctx            context.Context
	cancel         context.CancelFunc
	mu             sync.RWMutex
	connecting     bool
}

func NewConnectionManager(wClient *whatsmeow.Client, wsClient *WSClient, jobRunner *JobRunner) *ConnectionManager {
	ctx, cancel := context.WithCancel(context.Background())
	return &ConnectionManager{
		client:         wClient,
		wsClient:       wsClient,
		jobRunner:      jobRunner,
		whatsappStatus: StatusStarting,
		sessionStatus:  SessionNone,
		ctx:            ctx,
		cancel:         cancel,
	}
}

func (cm *ConnectionManager) Start() {
	cm.mu.Lock()
	if cm.client.Store.ID != nil {
		cm.sessionStatus = SessionValid
		cm.whatsappStatus = StatusReconnecting
	} else {
		cm.sessionStatus = SessionNone
		cm.whatsappStatus = StatusNoSession
	}
	cm.mu.Unlock()

	cm.client.AddEventHandler(cm.eventHandler)
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
	case "RESTART_WA":
		log.Println("[WA] Comando RESTART_WA recebido. Forçando emissão de novo QR...")
		go cm.forceRestartWhatsApp()
	case "AGENT_ACCEPTED":
		log.Println("[WA] Agent aceito pelo DO. Verificando estado...")
		go cm.connectWhatsApp()
	}
}

func (cm *ConnectionManager) forceRestartWhatsApp() {
	cm.mu.Lock()
	if cm.client.IsConnected() {
		cm.client.Disconnect()
	}
	cm.whatsappStatus = StatusNoSession
	cm.sessionStatus = SessionNone
	cm.mu.Unlock()

	cm.connectWhatsApp()
}

func (cm *ConnectionManager) connectWhatsApp() {
	cm.mu.Lock()
	if cm.client.IsConnected() || cm.connecting {
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
	cm.mu.RUnlock()

	if sStatus == SessionNone {
		log.Println("[WA] Solicitando novo QR Code...")

		qrCtx, qrCancel := context.WithTimeout(cm.ctx, 2*time.Minute)
		defer qrCancel()

		qrChan, err := cm.client.GetQRChannel(qrCtx)
		if err != nil {
			log.Printf("[WA] Erro ao obter GetQRChannel: %v", err)
			cm.updateStatus(StatusError, "Falha ao gerar QR Code: "+err.Error())
			return
		}

		// Escuta o qrChan concorrentemente ANTES de chamar Connect()
		go func() {
			for evt := range qrChan {
				if evt.Event == "code" {
					log.Println("[WA] QR Code recebido com sucesso. Enviando ao DO...")
					cm.mu.Lock()
					cm.whatsappStatus = StatusWaitingQR
					cm.mu.Unlock()

					qrMsg := QrUpdateMsg{
						BaseMessage: fillBase("QR_UPDATE", randomID),
						AgentID:     cm.wsClient.agentID,
						QRCode:      evt.Code,
						ExpiresAt:   time.Now().Add(1 * time.Minute).Format(time.RFC3339),
					}
					cm.wsClient.Send(qrMsg)
				} else if evt.Event == "timeout" || evt.Event == "error" {
					log.Printf("[WA] Evento do QR Channel: %s", evt.Event)
					cm.updateStatus(StatusDisconnected, "QR "+evt.Event)
				}
			}
		}()

		// Agora o Connect() pode rodar enquanto a goroutine acima consome os QR Codes
		err = cm.client.Connect()
		if err != nil {
			log.Printf("[WA] Erro ao conectar cliente: %v", err)
			cm.updateStatus(StatusError, "Erro de conexao: "+err.Error())
			return
		}

	} else {
		log.Println("[WA] Reconectando sessão existente...")
		err := cm.client.Connect()
		if err != nil {
			log.Printf("[WA] Erro na reconexão: %v", err)
			cm.updateStatus(StatusError, err.Error())
		}
	}
}

func (cm *ConnectionManager) eventHandler(evt interface{}) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	switch v := evt.(type) {
	case *events.Connected:
		cm.sessionStatus = SessionValid
		cm.whatsappStatus = StatusConnected
		cm.sendStatusMessageLocked("")
	case *events.Disconnected:
		cm.whatsappStatus = StatusDisconnected
		cm.sendStatusMessageLocked("")
	case *events.LoggedOut:
		cm.sessionStatus = SessionNone
		cm.whatsappStatus = StatusNoSession
		cm.sendStatusMessageLocked("Logged out from another device")
	case *events.ConnectFailure:
		cm.whatsappStatus = StatusError
		cm.sendStatusMessageLocked(string(v.Reason))
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
	cm.client.Disconnect()
}