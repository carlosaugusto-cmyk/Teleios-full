package agent

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"google.golang.org/protobuf/proto"
)

func fetchMediaBytes(s string) ([]byte, string, error) {
	if strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") {
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Get(s)
		if err != nil {
			return nil, "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, "", fmt.Errorf("HTTP %d ao baixar mídia", resp.StatusCode)
		}
		data, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, "", err
		}
		mime := resp.Header.Get("Content-Type")
		if mime == "" || mime == "application/octet-stream" {
			mime = http.DetectContentType(data)
		}
		return data, mime, nil
	}

	if strings.HasPrefix(s, "data:") {
		parts := strings.SplitN(s, ",", 2)
		if len(parts) == 2 {
			meta := parts[0]
			dataStr := parts[1]
			mime := "application/octet-stream"
			if idx := strings.Index(meta, ";"); idx != -1 {
				mime = strings.TrimPrefix(meta[:idx], "data:")
			}
			data, err := base64.StdEncoding.DecodeString(dataStr)
			return data, mime, err
		}
	}

	data, err := base64.StdEncoding.DecodeString(s)
	if err == nil && len(data) > 0 {
		return data, http.DetectContentType(data), nil
	}

	return nil, "", fmt.Errorf("formato de mídia não suportado")
}

type JobRunner struct {
	clientProvider func() *whatsmeow.Client
	client         *whatsmeow.Client
	wsClient       *WSClient
	jobChan        chan SendJobMsg
	paused         bool
	pauseMut       sync.RWMutex
	processed      map[string]JobStatus
	processedMut   sync.Mutex
}

func NewJobRunner(client *whatsmeow.Client, wsClient *WSClient) *JobRunner {
	jr := &JobRunner{
		client:    client,
		wsClient:  wsClient,
		jobChan:   make(chan SendJobMsg, 100),
		paused:    false,
		processed: make(map[string]JobStatus),
	}
	go jr.workerLoop()
	return jr
}

func NewJobRunnerWithProvider(clientProvider func() *whatsmeow.Client, wsClient *WSClient) *JobRunner {
	jr := &JobRunner{
		clientProvider: clientProvider,
		wsClient:       wsClient,
		jobChan:        make(chan SendJobMsg, 100),
		paused:         false,
		processed:      make(map[string]JobStatus),
	}
	go jr.workerLoop()
	return jr
}

func (jr *JobRunner) getClient() *whatsmeow.Client {
	if jr.clientProvider != nil {
		return jr.clientProvider()
	}
	return jr.client
}

func (jr *JobRunner) Enqueue(job SendJobMsg) {
	jr.processedMut.Lock()
	if status, exists := jr.processed[job.JobID]; exists {
		jr.processedMut.Unlock()
		if status == JobSent {
			jr.wsClient.Send(JobAckMsg{BaseMessage: fillBase("JOB_ACK", randomID), AgentID: jr.wsClient.agentID, JobID: job.JobID, Status: JobSent, SentAt: time.Now().UTC().Format(time.RFC3339)})
		}
		return
	}
	jr.processed[job.JobID] = JobProcessing
	jr.processedMut.Unlock()

	log.Printf("[JOB %s] Enfileirado no Agent Go (dest: %s)", job.JobID, job.RecipientJID)

	jr.wsClient.Send(JobAckMsg{
		BaseMessage: fillBase("JOB_ACK", randomID),
		AgentID:     jr.wsClient.agentID,
		JobID:       job.JobID,
		Status:      JobClaimed,
	})
	jr.jobChan <- job
}

func (jr *JobRunner) Pause() {
	jr.pauseMut.Lock()
	jr.paused = true
	jr.pauseMut.Unlock()
	log.Println("[JobRunner] Pausado.")
}

func (jr *JobRunner) Resume() {
	jr.pauseMut.Lock()
	jr.paused = false
	jr.pauseMut.Unlock()
	log.Println("[JobRunner] Retomado.")
}

func (jr *JobRunner) workerLoop() {
	for job := range jr.jobChan {
		for {
			jr.pauseMut.RLock()
			p := jr.paused
			jr.pauseMut.RUnlock()
			if !p {
				break
			}
			time.Sleep(1 * time.Second)
		}

		jr.processJob(job)
	}
}

func (jr *JobRunner) processJob(job SendJobMsg) {
	phone := strings.TrimSpace(job.RecipientJID)
	if strings.Contains(phone, "direct_default") {
		phone = "5511999998888@s.whatsapp.net"
	}
	if !strings.Contains(phone, "@") {
		phone = phone + "@s.whatsapp.net"
	}
	jid, err := types.ParseJID(phone)
	if err != nil {
		log.Printf("[JOB %s] JID inválido (%s): %v", job.JobID, phone, err)
		jr.sendFailed(job, fmt.Sprintf("Invalid JID: %v", err), false)
		return
	}

	// Validação de grupos: o identificador do grupo DEVE ser numérico
	if jid.Server == types.GroupServer {
		for _, ch := range jid.User {
			if ch < '0' || ch > '9' {
				log.Printf("[JOB %s] JID de grupo inválido (não numérico: %s)", job.JobID, jid.String())
				jr.sendFailed(job, fmt.Sprintf("JID de grupo inválido (não numérico): %s", jid.String()), false)
				return
			}
		}
	}

	log.Printf("[JOB %s] Processando envio para %s...", job.JobID, jid.String())

	cli := jr.getClient()
	if cli == nil {
		log.Printf("[JOB %s] Erro: cliente WhatsApp não disponível.", job.JobID)
		jr.sendFailed(job, "Cliente WhatsApp não disponível", true)
		return
	}

	var msg *waProto.Message

	// Se houver MediaUrl, fazer upload e anexar
	if job.MediaUrl != "" {
		data, mime, err := fetchMediaBytes(job.MediaUrl)
		if err == nil && len(data) > 0 {
			if strings.HasPrefix(mime, "image/") {
				log.Printf("[JOB %s] Fazendo upload de imagem (%d bytes, %s)...", job.JobID, len(data), mime)
				uploaded, err := cli.Upload(context.Background(), data, whatsmeow.MediaImage)
				if err == nil {
					msg = &waProto.Message{
						ImageMessage: &waProto.ImageMessage{
							Caption:       proto.String(job.Content),
							Mimetype:      proto.String(mime),
							URL:           &uploaded.URL,
							DirectPath:    &uploaded.DirectPath,
							MediaKey:      uploaded.MediaKey,
							FileEncSHA256: uploaded.FileEncSHA256,
							FileSHA256:    uploaded.FileSHA256,
							FileLength:    &uploaded.FileLength,
						},
					}
					log.Printf("[JOB %s] Imagem anexada com sucesso.", job.JobID)
				} else {
					log.Printf("[JOB %s] Erro no upload da imagem: %v (enviando como texto)", job.JobID, err)
				}
			} else if strings.HasPrefix(mime, "audio/") {
				log.Printf("[JOB %s] Fazendo upload de áudio (%d bytes, %s)...", job.JobID, len(data), mime)
				uploaded, err := cli.Upload(context.Background(), data, whatsmeow.MediaAudio)
				if err == nil {
					msg = &waProto.Message{
						AudioMessage: &waProto.AudioMessage{
							Mimetype:      proto.String(mime),
							URL:           &uploaded.URL,
							DirectPath:    &uploaded.DirectPath,
							MediaKey:      uploaded.MediaKey,
							FileEncSHA256: uploaded.FileEncSHA256,
							FileSHA256:    uploaded.FileSHA256,
							FileLength:    &uploaded.FileLength,
							PTT:           proto.Bool(true),
						},
					}
					log.Printf("[JOB %s] Áudio anexado com sucesso.", job.JobID)
				}
			}
		} else {
			log.Printf("[JOB %s] Aviso: não foi possível carregar mediaUrl %s: %v", job.JobID, job.MediaUrl, err)
		}
	}

	if msg == nil {
		msg = &waProto.Message{
			Conversation: proto.String(job.Content),
		}
	}

	maxAttempts := 3
	backoff := 2 * time.Second

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		currentCli := jr.getClient()
		if currentCli == nil || !currentCli.IsConnected() {
			log.Printf("[JOB %s] WhatsApp desconectado. Aguardando (tentativa %d/%d)...", job.JobID, attempt, maxAttempts)
			time.Sleep(2 * time.Second)
			if attempt == maxAttempts {
				jr.sendFailed(job, "Not connected to WhatsApp", true)
				return
			}
			continue
		}

		sendCtx, sendCancel := context.WithTimeout(context.Background(), 15*time.Second)
		resp, err := currentCli.SendMessage(sendCtx, jid, msg)
		sendCancel()
		if err != nil {
			log.Printf("[JOB %s] Erro ao enviar mensagem (tentativa %d/%d): %v", job.JobID, attempt, maxAttempts, err)
			if attempt == maxAttempts {
				jr.sendFailed(job, err.Error(), true)
				return
			}
			time.Sleep(backoff)
			backoff *= 2
			continue
		}

		log.Printf("[JOB %s] *** DISPARO CONCLUÍDO COM SUCESSO! *** Timestamp: %v", job.JobID, resp.Timestamp)

		// Success
		jr.wsClient.Send(JobAckMsg{
			BaseMessage: fillBase("JOB_ACK", randomID),
			AgentID:     jr.wsClient.agentID,
			JobID:       job.JobID,
			Status:      JobSent,
			SentAt:      time.Now().UTC().Format(time.RFC3339),
		})
		jr.processedMut.Lock()
		jr.processed[job.JobID] = JobSent
		jr.processedMut.Unlock()
		return
	}
}

func (jr *JobRunner) sendFailed(job SendJobMsg, errMsg string, retryable bool) {
	jr.processedMut.Lock()
	delete(jr.processed, job.JobID)
	jr.processedMut.Unlock()

	log.Printf("[JOB %s] Disparo FALHOU: %s", job.JobID, errMsg)

	jr.wsClient.Send(JobFailedMsg{
		BaseMessage: fillBase("JOB_FAILED", randomID),
		AgentID:     jr.wsClient.agentID,
		JobID:       job.JobID,
		Error:       errMsg,
		Attempt:     3,
		Retryable:   retryable,
	})
}
