package agent

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"google.golang.org/protobuf/proto"
)

type JobRunner struct {
	client    *whatsmeow.Client
	wsClient  *WSClient
	jobChan   chan SendJobMsg
	paused    bool
	pauseMut  sync.RWMutex
	processed map[string]JobStatus
	processedMut sync.Mutex
}

func NewJobRunner(client *whatsmeow.Client, wsClient *WSClient) *JobRunner {
	jr := &JobRunner{
		client:   client,
		wsClient: wsClient,
		jobChan:  make(chan SendJobMsg, 100),
		paused:   false,
		processed: make(map[string]JobStatus),
	}
	go jr.workerLoop()
	return jr
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
	// Manda o CLAIM antes mesmo de enfileirar localmente
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
}

func (jr *JobRunner) Resume() {
	jr.pauseMut.Lock()
	jr.paused = false
	jr.pauseMut.Unlock()
}

func (jr *JobRunner) workerLoop() {
	for job := range jr.jobChan {
		// Wait if paused
		for {
			jr.pauseMut.RLock()
			p := jr.paused
			jr.pauseMut.RUnlock()
			if !p {
				break
			}
			time.Sleep(1 * time.Second)
		}

		// Process
		jr.processJob(job)
	}
}

func (jr *JobRunner) processJob(job SendJobMsg) {
	jid, err := types.ParseJID(job.RecipientJID)
	if err != nil {
		jr.sendFailed(job, fmt.Sprintf("Invalid JID: %v", err), false)
		return
	}

	msg := &waProto.Message{
		Conversation: proto.String(job.Content),
	}

	// Retry logic
	maxAttempts := 3
	backoff := 2 * time.Second

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		// If not connected, fail retryable right away (connection manager handles reconnect)
		if !jr.client.IsConnected() {
			time.Sleep(2 * time.Second) // wait a bit before next attempt in case it's reconnecting
			if attempt == maxAttempts {
				jr.sendFailed(job, "Not connected", true)
				return
			}
			continue
		}

		_, err := jr.client.SendMessage(context.Background(), jid, msg)
		if err != nil {
			log.Printf("Send attempt %d failed: %v", attempt, err)
			if attempt == maxAttempts {
				jr.sendFailed(job, err.Error(), true)
				return
			}
			time.Sleep(backoff)
			backoff *= 2
			continue
		}

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
	jr.wsClient.Send(JobFailedMsg{
		BaseMessage: fillBase("JOB_FAILED", randomID),
		AgentID:     jr.wsClient.agentID,
		JobID:       job.JobID,
		Error:       errMsg,
		Attempt:     3, // In our basic logic, if it gets here, it exhausted or failed bad
		Retryable:   retryable,
	})
}
