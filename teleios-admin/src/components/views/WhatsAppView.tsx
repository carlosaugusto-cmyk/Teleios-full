import React, { useState, useEffect } from 'react';
import { useAgentWebSocket } from '../../hooks/useAgentWebSocket.ts';
import { QRCodeSVG } from 'qrcode.react';
import {
  Wifi,
  WifiOff,
  Smartphone,
  RefreshCw,
  Link2,
  CheckCircle2,
  MessageCircle,
  Star,
} from 'lucide-react';
import {
  WaDestination,
  getSavedChannels,
  getGlobalWhatsAppChannel,
  setGlobalWhatsAppChannel,
  GLOBAL_CHANNEL_CHANGE_EVENT,
} from '../../services/whatsappChannels.service.ts';

export default function WhatsAppView() {
  const {
    agentStatus,
    whatsappStatus,
    sessionStatus,
    qrCode,
    qrExpiresAt,
    qrVersion,
    lastSeen,
    lastError,
    isConnected,
    sendCommand,
  } = useAgentWebSocket();

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Canais cadastrados salvos
  const [channels, setChannels] = useState<WaDestination[]>(getSavedChannels);

  // Canal Global Selecionado
  const [globalChannel, setGlobalChannel] = useState<WaDestination | null>(() => getGlobalWhatsAppChannel());
  const [globalSaveFeedback, setGlobalSaveFeedback] = useState<string | null>(null);

  // Ouvinte reativo para atualizações do canal global
  useEffect(() => {
    const handleGlobalUpdate = (e: any) => {
      if (e.detail) {
        setGlobalChannel(e.detail);
      } else {
        setGlobalChannel(getGlobalWhatsAppChannel());
      }
    };
    window.addEventListener(GLOBAL_CHANNEL_CHANGE_EVENT, handleGlobalUpdate);
    return () => window.removeEventListener(GLOBAL_CHANNEL_CHANGE_EVENT, handleGlobalUpdate);
  }, []);

  // Se houver canais e nenhum global definido, seleciona automaticamente o primeiro
  useEffect(() => {
    if (channels.length > 0 && !globalChannel) {
      const initial = getGlobalWhatsAppChannel() || channels[0];
      handleSelectGlobalChannel(initial);
    }
  }, [channels]);

  const handleSelectGlobalChannel = async (target: WaDestination | string) => {
    const updated = await setGlobalWhatsAppChannel(target);
    if (updated) {
      setGlobalChannel(updated);
      setChannels((prev) =>
        prev.map((c) => ({
          ...c,
          isGlobal: c.jid === updated.jid || c.id === updated.id,
        }))
      );
      setGlobalSaveFeedback(`Canal Global alterado para: "${updated.name}"`);
      setTimeout(() => setGlobalSaveFeedback(null), 4000);
    }
  };

  // Countdown do QR Code
  useEffect(() => {
    if (!qrExpiresAt || whatsappStatus !== 'WAITING_QR') {
      setTimeLeft(null);
      return;
    }
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.round((new Date(qrExpiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [qrExpiresAt, whatsappStatus]);

  const handleConnect = () => sendCommand('CONNECT_WA');
  const handleNewPairing = () => sendCommand('RESTART_WA');

  const agentOnline = agentStatus === 'ONLINE' || agentStatus === 'STALE';
  const noSession = sessionStatus === 'NONE';
  const isWaitingQr = whatsappStatus === 'WAITING_QR';
  const isConnectedWA = whatsappStatus === 'CONNECTED';
  const isStarting =
    whatsappStatus === 'STARTING' || whatsappStatus === 'RECONNECTING' || whatsappStatus === 'AUTHENTICATING';

  return (
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6 min-w-0 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-[#374151] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-[#10B981] shrink-0" />
            <span>WhatsApp Agent & Destinos</span>
          </h1>
          <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
            Gerencie o pareamento do WhatsApp e sincronize automaticamente seus Grupos, Comunidades e Canais.
          </p>
        </div>
      </div>

      {/* ── Status + QR ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Status Panel */}
        <div className="bg-[#111827] border border-[#374151] rounded-xl p-4 sm:p-6 space-y-3.5 sm:space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-white border-b border-[#374151] pb-2">Status da Conexão</h2>

          <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#9CA3AF]">WebSocket Admin:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isConnected ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : 'bg-rose-900/40 text-rose-300'}`}>
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#9CA3AF]">Agent Go:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${agentStatus === 'ONLINE' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : agentStatus === 'STALE' ? 'bg-amber-900/40 text-amber-300 border border-amber-700' : 'bg-rose-900/40 text-rose-300'}`}>
                {agentStatus}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#9CA3AF]">WhatsApp:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isConnectedWA ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : isWaitingQr || isStarting ? 'bg-amber-900/40 text-amber-300 border border-amber-700' : 'bg-rose-900/40 text-rose-300'}`}>
                {whatsappStatus}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#9CA3AF]">Sessão Salva:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${sessionStatus === 'VALID' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : 'bg-[#1F2937] text-[#9CA3AF] border border-[#374151]'}`}>
                {sessionStatus === 'VALID' ? 'Sim' : 'Não'}
              </span>
            </div>
          </div>

          {lastSeen && (
            <div className="text-xs text-[#9CA3AF] pt-2 border-t border-[#374151]">
              Último sinal do Agent: {new Date(lastSeen).toLocaleTimeString('pt-BR')}
            </div>
          )}
          {lastError && (
            <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900 p-2.5 rounded-lg break-words">
              Último Erro: {lastError}
            </div>
          )}
        </div>

        {/* QR / Actions Panel */}
        <div className="bg-[#111827] border border-[#374151] rounded-xl p-4 sm:p-6 flex flex-col items-center justify-center min-h-[360px] sm:min-h-[400px]">
          {agentStatus === 'OFFLINE' && (
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 border-4 border-[#374151] border-t-[#0077C8] rounded-full animate-spin" />
              <p className="text-[#9CA3AF] text-sm font-medium">Aguardando o Agent Go iniciar...</p>
              <p className="text-xs text-[#4B5563]">Inicie o serviço Go no seu terminal ou servidor</p>
            </div>
          )}

          {agentOnline && isConnectedWA && (
            <div className="flex flex-col items-center space-y-3 text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-900/30 rounded-full flex items-center justify-center border border-emerald-700">
                <Wifi className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-400" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-emerald-300">WhatsApp Conectado</h2>
              <p className="text-xs text-[#9CA3AF] max-w-xs">
                Pronto para envio de devocionais e sincronização de grupos.
              </p>
              <button
                onClick={handleNewPairing}
                className="mt-2 px-3.5 py-2 text-xs bg-[#1F2937] text-[#9CA3AF] rounded-lg hover:bg-rose-950/30 hover:text-rose-400 border border-[#374151] transition cursor-pointer"
              >
                Vincular outro dispositivo
              </button>
            </div>
          )}

          {agentOnline && isWaitingQr && qrCode && (
            <div className="flex flex-col items-center space-y-4 py-1 w-full">
              <div className="flex items-center justify-between w-full px-2 gap-2">
                <h2 className="text-sm sm:text-base font-semibold text-white">Escaneie o QR Code</h2>
                {qrVersion > 0 && (
                  <span className="text-xs bg-[#1F2937] text-[#F5A800] px-2.5 py-1 rounded-md font-mono border border-[#374151]">
                    v{qrVersion}
                  </span>
                )}
              </div>
              <div className="p-4 sm:p-5 bg-white rounded-2xl shadow-2xl flex items-center justify-center">
                <QRCodeSVG key={`${qrCode}_${qrVersion}`} value={qrCode} size={260} level="M" marginSize={2} />
              </div>
              {timeLeft !== null && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-[#9CA3AF]">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${timeLeft > 5 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="font-medium">{timeLeft > 0 ? `Expira em ${timeLeft}s` : 'Aguardando novo QR...'}</span>
                </div>
              )}
            </div>
          )}

          {agentOnline && isStarting && !qrCode && (
            <div className="flex flex-col items-center space-y-3 text-center">
              <div className="w-10 h-10 border-4 border-[#374151] border-t-[#10B981] rounded-full animate-spin" />
              <p className="text-[#9CA3AF] text-xs">Iniciando conexão...</p>
            </div>
          )}

          {agentOnline && !isConnectedWA && !isWaitingQr && !isStarting && noSession && (
            <div className="flex flex-col items-center space-y-3 text-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#1F2937] rounded-full flex items-center justify-center border border-[#374151]">
                <WifiOff className="w-6 h-6 sm:w-7 sm:h-7 text-[#4B5563]" />
              </div>
              <p className="text-sm font-semibold text-white">WhatsApp não conectado</p>
              <button
                onClick={handleConnect}
                className="px-5 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer shadow"
              >
                <Link2 className="w-4 h-4" />
                <span>Conectar WhatsApp</span>
              </button>
            </div>
          )}

          {agentOnline && !isConnectedWA && !isWaitingQr && !isStarting && !noSession && (
            <div className="flex flex-col items-center space-y-3 text-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-amber-900/20 rounded-full flex items-center justify-center border border-amber-700">
                <Smartphone className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-white">Sessão desconectada</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 bg-[#0077C8] hover:bg-[#005F9E] text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reconectar</span>
                </button>
                <button
                  onClick={handleNewPairing}
                  className="px-4 py-2 bg-[#1F2937] text-[#9CA3AF] hover:text-rose-400 rounded-lg text-xs border border-[#374151] cursor-pointer"
                >
                  Novo Pareamento
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SEÇÃO DE DESTAQUE: CANAL GLOBAL PADRÃO DE WHATSAPP ── */}
      <div className="bg-gradient-to-r from-[#111827] to-[#1E293B] border-2 border-[#F5A800]/50 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#374151] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[#F5A800] flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Canal Global Padrão de WhatsApp</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                  Global Ativo
                </span>
              </h2>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                Destino unificado: <strong>todos os disparos diretos e agendamentos</strong> do sistema usarão este canal por padrão.
              </p>
            </div>
          </div>

          {globalChannel && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ativo no Sistema</span>
              </span>
            </div>
          )}
        </div>

        {/* Seleção do Canal Global */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-[#9CA3AF] mb-1.5 uppercase tracking-wider">
              Selecione o Canal Global Principal:
            </label>
            {channels.length === 0 ? (
              <p className="text-xs text-amber-400 bg-amber-950/20 border border-amber-900/50 p-2.5 rounded-xl">
                Nenhum canal cadastrado ainda.
              </p>
            ) : (
              <select
                value={globalChannel?.jid || ''}
                onChange={(e) => handleSelectGlobalChannel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#1F2937] border-2 border-amber-500/40 rounded-xl text-xs sm:text-sm text-white font-medium focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {channels.map((ch) => (
                  <option key={ch.jid} value={ch.jid}>
                    ⭐ {ch.name} ({ch.type === 'newsletter' ? 'Canal' : ch.type === 'group' ? 'Grupo' : ch.type === 'community' ? 'Comunidade' : 'Contato'}) — {ch.jid}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="bg-[#1F2937]/70 border border-[#374151] rounded-xl p-3 text-xs space-y-1">
            <span className="text-[#9CA3AF] block text-[11px] font-bold uppercase">Canal Selecionado:</span>
            <span className="text-white font-semibold truncate block">
              {globalChannel ? globalChannel.name : 'Nenhum definido'}
            </span>
            <span className="text-emerald-400 font-mono text-[11px] truncate block">
              {globalChannel ? globalChannel.jid : 'Aguardando seleção'}
            </span>
          </div>
        </div>

        {globalSaveFeedback && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{globalSaveFeedback}</span>
          </div>
        )}
      </div>
    </div>
  );
}