import { useState, useEffect, useRef, useCallback } from 'react';
import { loadSession } from '../services/security.service.ts';
import type { 
  AdminBroadcastMessage,
  AgentStatus,
  WhatsAppStatus,
  SessionStatus
} from '../../cloudflare-worker/src/protocol';

interface UseAgentWebSocketReturn {
  agentStatus: AgentStatus;
  whatsappStatus: WhatsAppStatus;
  sessionStatus: SessionStatus;
  qrCode: string | null;
  lastSeen: number | null;
  lastError: string | null;
  sendCommand: (type: string, payload?: Record<string, unknown>) => void;
  isConnected: boolean;
}

export function useAgentWebSocket(): UseAgentWebSocketReturn {
  const session = loadSession();
  
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('OFFLINE');
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>('DISCONNECTED');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('NONE');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (!session?.token) return;

    // Converte a URL da API para WSS e passa o token na query (browser não suporta header)
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
    const wsUrl = apiUrl.replace(/^http/, 'ws') + `/api/agent/ws?mode=admin&token=${session.token}`;

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
            if (msg.lastError) setLastError(msg.lastError);
            if (msg.whatsappStatus === 'CONNECTED') setQrCode(null);
            break;
          case 'ADMIN_QR':
            setQrCode(msg.qrCode);
            break;
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setAgentStatus('OFFLINE');
      // Tentativa de reconexão
      reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('Admin WS error:', err);
      ws.close();
    };

    wsRef.current = ws;
  }, [session?.token]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const sendCommand = useCallback((type: string, payload?: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return {
    agentStatus,
    whatsappStatus,
    sessionStatus,
    qrCode,
    lastSeen,
    lastError,
    sendCommand,
    isConnected,
  };
}
