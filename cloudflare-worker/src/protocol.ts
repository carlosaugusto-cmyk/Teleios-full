/**
 * Teleios Agent Protocol v1
 * Mensagens trafegam como JSON sobre WebSocket.
 * O Agent sempre inicia a conexão (nunca o servidor).
 */

// ─── Tipos base ──────────────────────────────────────────────────────────────

export type AgentStatus = 'ONLINE' | 'STALE' | 'OFFLINE';

export type WhatsAppStatus =
  | 'STARTING'
  | 'NO_SESSION'
  | 'WAITING_QR'
  | 'AUTHENTICATING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'AUTH_REQUIRED'
  | 'PROTOCOL_ERROR'
  | 'ERROR';

export type SessionStatus = 'NONE' | 'VALID';

export type JobStatus =
  | 'PENDING'
  | 'READY'
  | 'CLAIMED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'RETRYING'
  | 'CANCELLED';

// ─── Envelope base ───────────────────────────────────────────────────────────

export interface BaseMessage {
  type: string;
  version: 1;
  requestId: string;
  timestamp: string; // ISO8601
}

// ─── Agent → DO ──────────────────────────────────────────────────────────────

export interface RegisterAgentMsg extends BaseMessage {
  type: 'REGISTER_AGENT';
  agentId: string;
  agentVersion: string;
  capabilities: string[];
}

export interface HeartbeatMsg extends BaseMessage {
  type: 'HEARTBEAT';
  agentId: string;
  whatsappStatus: WhatsAppStatus;
  sessionStatus: SessionStatus;
}

export interface StatusUpdateMsg extends BaseMessage {
  type: 'STATUS_UPDATE';
  agentId: string;
  whatsappStatus: WhatsAppStatus;
  sessionStatus: SessionStatus;
  lastError?: string;
  agentVersion?: string;
}

export interface QrUpdateMsg extends BaseMessage {
  type: 'QR_UPDATE';
  agentId: string;
  qrCode: string;      // string base do QR (para renderizar com qrcode.react)
  qrVersion?: number;
  generatedAt?: string;
  expiresAt: string;   // ISO8601
}

export interface SessionUpdateMsg extends BaseMessage {
  type: 'SESSION_UPDATE';
  agentId: string;
  sessionStatus: SessionStatus;
}

export interface JobAckMsg extends BaseMessage {
  type: 'JOB_ACK';
  agentId: string;
  jobId: string;
  status: 'CLAIMED' | 'PROCESSING' | 'SENT';
  sentAt?: string;
}

export interface JobFailedMsg extends BaseMessage {
  type: 'JOB_FAILED';
  agentId: string;
  jobId: string;
  error: string;
  attempt: number;
  retryable: boolean;
}

export interface ChannelItem {
  jid: string;
  name: string;
  type: string;
}

export interface ChannelsUpdateMsg extends BaseMessage {
  type: 'CHANNELS_UPDATE';
  agentId: string;
  channels: ChannelItem[];
}

export type AgentToDoMessage =
  | RegisterAgentMsg
  | HeartbeatMsg
  | StatusUpdateMsg
  | QrUpdateMsg
  | SessionUpdateMsg
  | JobAckMsg
  | JobFailedMsg
  | ChannelsUpdateMsg;

// ─── DO → Agent ──────────────────────────────────────────────────────────────

export interface AgentAcceptedMsg extends BaseMessage {
  type: 'AGENT_ACCEPTED';
  serverId: string;
  serverTime: string;
}

export interface PingMsg extends BaseMessage {
  type: 'PING';
}

export interface SendJobMsg extends BaseMessage {
  type: 'SEND_JOB';
  jobId: string;
  studyId: string;
  channelId: string;
  recipientJid: string;  // ex: "5511999998888@s.whatsapp.net"
  content: string;
  mediaUrl?: string;
}

export interface CancelJobMsg extends BaseMessage {
  type: 'CANCEL_JOB';
  jobId: string;
}

export interface PauseMsg extends BaseMessage {
  type: 'PAUSE';
}

export interface ResumeMsg extends BaseMessage {
  type: 'RESUME';
}

export interface SyncResponseMsg extends BaseMessage {
  type: 'SYNC_RESPONSE';
  pendingJobs: SendJobMsg[];
}

export interface RestartWaMsg extends BaseMessage {
  type: 'RESTART_WA';
}

/** Enviado ao agent para iniciar primeira conexão/pareamento sem descartar sessão. */
export interface ConnectWaMsg extends BaseMessage {
  type: 'CONNECT_WA';
}

export interface SyncGroupsMsg extends BaseMessage {
  type: 'SYNC_GROUPS';
}

export type DoToAgentMessage =
  | AgentAcceptedMsg
  | PingMsg
  | SendJobMsg
  | CancelJobMsg
  | PauseMsg
  | ResumeMsg
  | RestartWaMsg
  | ConnectWaMsg
  | SyncGroupsMsg
  | SyncResponseMsg;


// ─── DO → Admin clients (broadcast) ─────────────────────────────────────────

export interface AdminStatusMsg extends BaseMessage {
  type: 'ADMIN_STATUS';
  agentStatus: AgentStatus;
  whatsappStatus: WhatsAppStatus;
  sessionStatus: SessionStatus;
  lastSeen: number;   // unix ms
  lastError?: string;
  qrCode?: string | null;
  qrExpiresAt?: string | null;
  qrVersion?: number;
}

export interface AdminQrMsg extends BaseMessage {
  type: 'ADMIN_QR';
  qrCode: string;
  expiresAt: string;
  qrVersion?: number;
  qrHash?: string;
  generatedAt?: string;
}

export interface AdminJobUpdateMsg extends BaseMessage {
  type: 'ADMIN_JOB_UPDATE';
  jobId: string;
  status: JobStatus;
  sentAt?: string;
  error?: string;
}

export type AdminBroadcastMessage = AdminStatusMsg | AdminQrMsg | AdminJobUpdateMsg;

// ─── Tipos de dados persistidos ──────────────────────────────────────────────

export interface Job {
  id: string;
  studyId: string;
  channelId: string;
  agentId: string;
  recipientJid: string;
  content: string;
  mediaUrl?: string;
  scheduledAt: string | null;
  status: JobStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  claimedAt?: string;
  sentAt?: string;
}

export interface Channel {
  id: string;
  name: string;
  whatsappJid: string;
  agentId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function makeEnvelope<T extends { type: string }>(
  msg: T
): T & Pick<BaseMessage, 'version' | 'requestId' | 'timestamp'> {
  return {
    version: 1,
    requestId: makeId('req'),
    timestamp: new Date().toISOString(),
    ...msg,
  };
}
