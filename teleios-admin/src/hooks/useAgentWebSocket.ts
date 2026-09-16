import { useState, useEffect, useRef, useCallback } from 'react';
import { loadSession } from '../services/security.service.ts';
import type { 
  AdminBroadcastMessage,
  AgentStatus,
  WhatsAppStatus,
  SessionStatus
} from '../types/protocol.ts';

interface UseAgentWebSocketReturn {
  agentStatus: AgentStatus;
  whatsappStatus: WhatsAppStatus;
  sessionStatus: SessionStatus;
  qrCode: string | null;
  qrExpiresAt: string | null;
  qrVersion: number;
  qrHash: string | null;
  lastSeen: number | null;
  lastError: string | null;
  sendCommand: (type: string, payload?: Record<string, unknown>) => void;
  isConnected: boolean;
  refreshStatus: () => Promise<void>;
}

const PRODUCTION_API_URL = 'https://teleios-api-worker.ca88321499.workers.dev';

export function useAgentWebSocket(): UseAgentWebSocketReturn {
  const session = loadSession();
  
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('OFFLINE');
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>('DISCONNECTED');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('NONE');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null);
  const [qrVersion, setQrVersion] = useState<number>(0);
  const [qrHash, setQrHash] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? PRODUCTION_API_URL : 'http://localhost:8787');

  const pollStatus = useCallback(async () => {
    if (!session?.token) return;
    try {
      const res = await fetch(`${apiBase}/api/agent/status`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (data.agentStatus) setAgentStatus(data.agentStatus);
          if (data.whatsappStatus) setWhatsappStatus(data.whatsappStatus);
          if (data.sessionStatus) setSessionStatus(data.sessionStatus);
          if (data.lastSeen) setLastSeen(data.lastSeen);
          if (data.lastError !== undefined) setLastError(data.lastError);
          if (data.hasQr && data.qrCode) {
            setQrCode(data.qrCode);
            setQrExpiresAt(data.qrExpiresAt || null);
          } else if (data.whatsappStatus !== 'WAITING_QR') {
            setQrCode(null);
            setQrExpiresAt(null);
          }
        }
      }
    } catch {}
  }, [apiBase, session?.token]);

  const connect = useCallback(() => {
    if (!session?.token) return;

    const wsUrl = apiBase.replace(/^http/, 'ws') + `/api/agent/ws?mode=admin&token=${encodeURIComponent(session.token)}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as AdminBroadcastMessage;
          
          switch (msg.type) {
            case 'ADMIN_STATUS':
              setAgentStatus(msg.agentStatus);
              setWhatsappStatus(msg.whatsappStatus);
              setSessionStatus(msg.sessionStatus);
              setLastSeen(msg.lastSeen);
              setLastError(msg.lastError ?? null);

              if (msg.whatsappStatus !== 'WAITING_QR' || msg.agentStatus === 'OFFLINE') {
                setQrCode(null);
                setQrExpiresAt(null);
                setQrVersion(0);
                setQrHash(null);
              } else if (msg.qrCode !== undefined) {
                setQrCode(msg.qrCode);
                setQrExpiresAt(msg.qrExpiresAt ?? null);
                if (msg.qrVersion !== undefined) setQrVersion(msg.qrVersion);
              }
              break;

            case 'ADMIN_QR':
              setQrCode(msg.qrCode);
              setQrExpiresAt(msg.expiresAt);
              if (msg.qrVersion !== undefined) setQrVersion(msg.qrVersion);
              if (msg.qrHash) {
                setQrHash(msg.qrHash);
              }
              break;
          }
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeoutRef.current = window.setTimeout(connect, 4000);
      };

      ws.onerror = (err) => {
        console.error('Admin WS error:', err);
        ws.close();
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
    }
  }, [apiBase, session?.token]);

  useEffect(() => {
    connect();
    pollStatus();
    const interval = setInterval(pollStatus, 5000);

    return () => {
      clearInterval(interval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect, pollStatus]);

  const sendCommand = useCallback((type: string, payload?: Record<string, unknown>) => {
    if (type === 'RESTART_WA' || type === 'CONNECT_WA') {
      setQrCode(null);
      setQrExpiresAt(null);
      setQrVersion(0);
      setQrHash(null);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    } else {
      fetch(`${apiBase}/api/agent/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.token}`,
        },
        body: JSON.stringify({ type, payload }),
      }).catch((e) => console.error('Failed to send command via HTTP fallback:', e));
    }
  }, [apiBase, session?.token]);

  return {
    agentStatus,
    whatsappStatus,
    sessionStatus,
    qrCode,
    qrExpiresAt,
    qrVersion,
    qrHash,
    lastSeen,
    lastError,
    sendCommand,
    isConnected,
    refreshStatus: pollStatus,
  };
}
