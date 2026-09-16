/**
 * Teleios Agent Protocol v1
 */

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

export interface BaseMessage {
  type: string;
  version: 1;
  requestId: string;
  timestamp: string;
}

export interface AdminStatusMsg extends BaseMessage {
  type: 'ADMIN_STATUS';
  agentStatus: AgentStatus;
  whatsappStatus: WhatsAppStatus;
  sessionStatus: SessionStatus;
  lastSeen: number;
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
  status: string;
  sentAt?: string;
  error?: string;
}

export type AdminBroadcastMessage = AdminStatusMsg | AdminQrMsg | AdminJobUpdateMsg;
