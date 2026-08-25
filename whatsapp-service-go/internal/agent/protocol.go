package agent

import (
	"time"
)

// Tipos base
type WhatsAppStatus string
type SessionStatus string
type JobStatus string

const (
	StatusStarting       WhatsAppStatus = "STARTING"
	StatusNoSession      WhatsAppStatus = "NO_SESSION"
	StatusWaitingQR      WhatsAppStatus = "WAITING_QR"
	StatusAuthenticating WhatsAppStatus = "AUTHENTICATING"
	StatusConnected      WhatsAppStatus = "CONNECTED"
	StatusDisconnected   WhatsAppStatus = "DISCONNECTED"
	StatusReconnecting   WhatsAppStatus = "RECONNECTING"
	StatusAuthRequired   WhatsAppStatus = "AUTH_REQUIRED"
	StatusProtocolError  WhatsAppStatus = "PROTOCOL_ERROR"
	StatusError          WhatsAppStatus = "ERROR"

	SessionNone  SessionStatus = "NONE"
	SessionValid SessionStatus = "VALID"

	JobClaimed    JobStatus = "CLAIMED"
	JobProcessing JobStatus = "PROCESSING"
	JobSent       JobStatus = "SENT"
	JobFailed     JobStatus = "FAILED"
)

type BaseMessage struct {
	Type      string `json:"type"`
	Version   int    `json:"version"`
	RequestID string `json:"requestId"`
	Timestamp string `json:"timestamp"`
}

// ─── Agent → DO ──────────────────────────────────────────────────────────────

type RegisterAgentMsg struct {
	BaseMessage
	AgentID      string   `json:"agentId"`
	AgentVersion string   `json:"agentVersion"`
	Capabilities []string `json:"capabilities"`
}

type HeartbeatMsg struct {
	BaseMessage
	AgentID        string         `json:"agentId"`
	WhatsAppStatus WhatsAppStatus `json:"whatsappStatus"`
	SessionStatus  SessionStatus  `json:"sessionStatus"`
}

type StatusUpdateMsg struct {
	BaseMessage
	AgentID        string         `json:"agentId"`
	WhatsAppStatus WhatsAppStatus `json:"whatsappStatus"`
	SessionStatus  SessionStatus  `json:"sessionStatus"`
	LastError      string         `json:"lastError,omitempty"`
	AgentVersion   string         `json:"agentVersion,omitempty"`
}

type QrUpdateMsg struct {
	BaseMessage
	AgentID   string `json:"agentId"`
	QRCode    string `json:"qrCode"`
	ExpiresAt string `json:"expiresAt"`
}

type SessionUpdateMsg struct {
	BaseMessage
	AgentID       string        `json:"agentId"`
	SessionStatus SessionStatus `json:"sessionStatus"`
}

type JobAckMsg struct {
	BaseMessage
	AgentID string    `json:"agentId"`
	JobID   string    `json:"jobId"`
	Status  JobStatus `json:"status"`
	SentAt  string    `json:"sentAt,omitempty"`
}

type JobFailedMsg struct {
	BaseMessage
	AgentID   string `json:"agentId"`
	JobID     string `json:"jobId"`
	Error     string `json:"error"`
	Attempt   int    `json:"attempt"`
	Retryable bool   `json:"retryable"`
}

// ─── DO → Agent ──────────────────────────────────────────────────────────────

// Generic struct to deserialize incoming DO messages and determine their Type
type IncomingMessage struct {
	Type string `json:"type"`
}

type SendJobMsg struct {
	BaseMessage
	JobID        string `json:"jobId"`
	StudyID      string `json:"studyId"`
	ChannelID    string `json:"channelId"`
	RecipientJID string `json:"recipientJid"`
	Content      string `json:"content"`
	MediaUrl     string `json:"mediaUrl,omitempty"`
}

type CancelJobMsg struct {
	BaseMessage
	JobID string `json:"jobId"`
}

type SyncResponseMsg struct {
	BaseMessage
	PendingJobs []SendJobMsg `json:"pendingJobs"`
}

// Helper to fill BaseMessage fields
func fillBase(msgType string, idGenerator func() string) BaseMessage {
	return BaseMessage{
		Type:      msgType,
		Version:   1,
		RequestID: idGenerator(),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}
