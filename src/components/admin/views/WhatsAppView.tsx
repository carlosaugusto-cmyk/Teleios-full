import React from 'react';
import { useAgentWebSocket } from '../../../hooks/useAgentWebSocket.ts';
import { QRCodeSVG } from 'qrcode.react';

export default function WhatsAppView() {
  const {
    agentStatus,
    whatsappStatus,
    sessionStatus,
    qrCode,
    lastSeen,
    lastError,
    isConnected,
    sendCommand
  } = useAgentWebSocket();

  const handleReconnect = () => sendCommand('RECONNECT');
  const handlePause = () => sendCommand('PAUSE');
  const handleResume = () => sendCommand('RESUME');
  const handleGenerateQR = () => sendCommand('RESTART_WA');

  const getAgentColor = () => {
    if (agentStatus === 'ONLINE') return 'bg-green-500';
    if (agentStatus === 'STALE') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getWhatsAppColor = () => {
    if (whatsappStatus === 'CONNECTED') return 'text-green-600';
    if (whatsappStatus === 'DISCONNECTED' || whatsappStatus === 'ERROR') return 'text-red-600';
    return 'text-yellow-600';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">WhatsApp Agent</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Painel de Status */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Status do Sistema</h2>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">WebSocket Admin:</span>
            <span className={`px-2 py-1 rounded text-sm font-medium ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">Agent Local/VPS:</span>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getAgentColor()}`}></div>
              <span className="font-medium text-gray-800">{agentStatus}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">WhatsApp:</span>
            <span className={`font-bold ${getWhatsAppColor()}`}>
              {whatsappStatus}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">Sessão Salva:</span>
            <span className="text-gray-800 font-medium">
              {sessionStatus === 'VALID' ? 'Sim' : 'Não'}
            </span>
          </div>

          {lastSeen && (
            <div className="text-xs text-gray-500 pt-2 border-t mt-4">
              Último sinal do Agent: {new Date(lastSeen).toLocaleTimeString()}
            </div>
          )}
          {lastError && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
              Último Erro: {lastError}
            </div>
          )}
        </div>

        {/* Painel de Ações / QR */}
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center min-h-[300px]">
          {whatsappStatus === 'WAITING_QR' && qrCode ? (
            <div className="flex flex-col items-center space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">Escaneie o QR Code</h2>
              <div className="p-4 bg-white border-4 border-gray-100 rounded-xl">
                <QRCodeSVG value={qrCode} size={200} />
              </div>
              <p className="text-sm text-gray-500 text-center">
                Abra o WhatsApp no seu celular, vá em "Aparelhos Conectados" e escaneie este código.
              </p>
            </div>
          ) : whatsappStatus === 'CONNECTED' ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-green-800">WhatsApp Conectado</h2>
              <p className="text-gray-500">O sistema está pronto para enviar mensagens.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4 text-center">
              {agentStatus === 'OFFLINE' ? (
                <>
                  <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                  <p className="text-gray-500">Aguardando o Agent iniciar...</p>
                </>
              ) : (
                <>
                  <p className="text-gray-600 font-medium">
                    {lastError === 'QR Timeout'
                      ? 'O tempo do QR Code expirou.'
                      : 'WhatsApp Desconectado.'}
                  </p>
                  <button
                    onClick={handleGenerateQR}
                    className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
                  >
                    Gerar Novo QR Code
                  </button>
                </>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Controles de Emergência */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Ações Operacionais</h2>
        <div className="flex gap-4">
          <button
            onClick={handleReconnect}
            disabled={agentStatus === 'OFFLINE'}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Forçar Reconexão WS
          </button>
          <button
            onClick={handlePause}
            disabled={agentStatus === 'OFFLINE'}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
          >
            Pausar Envios
          </button>
          <button
            onClick={handleResume}
            disabled={agentStatus === 'OFFLINE'}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Retomar Envios
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          As ações requerem que o Agent esteja Online (rodando no seu terminal ou VPS).
        </p>
      </div>

    </div>
  );
}