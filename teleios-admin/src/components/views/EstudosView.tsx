import React, { useState, useEffect } from 'react';
import { Sparkles, MessageSquare, RefreshCw, Send, Image as ImageIcon, FileText, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Study } from '../../types/index.ts';
import { apiFetch } from '../../services/api.service.ts';
import { DESTINATIONS } from '../../config/destinations.ts';
import { getStudyTitle, getStudyPreviewText, isStudyBinary } from '../../utils/contentSanitizer.ts';
import { getGlobalWhatsAppChannel } from '../../services/whatsappChannels.service.ts';

interface ChannelItem {
  id: string;
  name: string;
  whatsappJid: string;
  agentId: string;
  active: boolean;
}

interface EstudosViewProps {
  studies: Study[];
  onRefresh: () => void;
}

export const EstudosView: React.FC<EstudosViewProps> = ({ studies, onRefresh }) => {
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [dispatchModalStudy, setDispatchModalStudy] = useState<Study | null>(null);
  const [targetPhone, setTargetPhone] = useState<string>(() => getGlobalWhatsAppChannel()?.jid || DESTINATIONS.whatsapp.defaultRecipient);
  const [selectedChannelId, setSelectedChannelId] = useState<string>(() => getGlobalWhatsAppChannel()?.jid || getGlobalWhatsAppChannel()?.id || '');
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/channels')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setChannels(data.data);
          const globalChan = getGlobalWhatsAppChannel();
          if (globalChan) {
            setSelectedChannelId(globalChan.jid || globalChan.id);
          } else if (data.data.length > 0 && !selectedChannelId) {
            setSelectedChannelId(data.data[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleReprocessAI = async (id: string) => {
    setIsProcessingId(id);
    try {
      const res = await apiFetch(`/api/estudos/${id}/process-ai`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onRefresh();
        setFeedback('Estudo reprocessado com sucesso!');
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleDispatchWhatsApp = async (studyId: string) => {
    setIsDispatching(true);
    try {
      const payload: Record<string, string> = { studyId };
      const globalChan = getGlobalWhatsAppChannel();
      const finalChannel = selectedChannelId || globalChan?.jid || globalChan?.id;
      if (finalChannel) {
        payload.channelId = finalChannel;
      } else {
        payload.targetPhone = targetPhone;
      }

      const res = await apiFetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
        onRefresh();
        setDispatchModalStudy(null);
        setFeedback(`Job ${data.data?.id || ''} criado e enviado para a fila do WhatsApp.`);
        setTimeout(() => setFeedback(null), 5000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 min-w-0 w-full">
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-[#0077C8] shrink-0" />
          <span>Estudos</span>
        </h2>
        <button
          onClick={onRefresh}
          className="p-2 bg-[#1F2937] hover:bg-[#374151] text-white rounded-xl transition-colors border border-[#374151] cursor-pointer"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {feedback && (
        <div className="p-3.5 sm:p-4 bg-emerald-900/30 border border-emerald-800 text-emerald-400 rounded-xl flex items-center gap-2 mb-4 sm:mb-6 text-xs sm:text-sm">
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span className="font-medium">{feedback}</span>
        </div>
      )}

      {studies.length === 0 ? (
        <div className="text-center py-16 sm:py-20 bg-[#111827] border border-[#374151] rounded-2xl text-[#9CA3AF] px-4">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40 text-[#0077C8]" />
          <p className="text-base sm:text-lg font-medium text-white">Nenhum estudo encontrado.</p>
          <p className="text-xs sm:text-sm mt-1">Crie um novo estudo na aba "Novo Arquivo".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {studies.map((study) => (
            <div key={study.id} className="bg-[#111827] border border-[#374151] rounded-2xl overflow-hidden flex flex-col h-full shadow-sm">
              {/* Image Preview */}
              <div className="h-36 sm:h-40 bg-black relative">
                <img
                  src={study.generatedImgUrl || study.aiImageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'}
                  alt="Imagem do estudo"
                  className="w-full h-full object-cover opacity-85"
                />
              </div>

              {/* Content */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-base sm:text-lg text-white mb-1.5 line-clamp-1" title={getStudyTitle(study)}>
                  {getStudyTitle(study)}
                </h3>
                <p className="text-xs sm:text-sm text-[#9CA3AF] line-clamp-3 flex-1 mb-3.5 leading-relaxed">
                  {getStudyPreviewText(study)}
                </p>
                
                {/* Actions */}
                <div className="pt-3 border-t border-[#374151] flex items-center gap-2">
                  <button
                    onClick={() => setDispatchModalStudy(study)}
                    className="flex-1 py-2.5 bg-[#0077C8] hover:bg-[#005F9E] text-white text-xs font-bold rounded-xl transition-colors flex justify-center items-center gap-1.5 cursor-pointer shadow"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar WhatsApp</span>
                  </button>
                  <button
                    onClick={() => handleReprocessAI(study.id)}
                    disabled={isProcessingId === study.id}
                    className="p-2.5 bg-[#1F2937] hover:bg-[#374151] text-white border border-[#374151] rounded-xl transition-colors cursor-pointer"
                    title="Reprocessar IA"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProcessingId === study.id ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchModalStudy && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-[#111827] border border-[#374151] rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5">Enviar via WhatsApp</h3>
            <p className="text-[#9CA3AF] text-xs sm:text-sm mb-4 sm:mb-5">Confirme o número para enviar o resumo e a imagem.</p>
            
            <div className="space-y-3.5">
              {channels.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Canal de Destino</label>
                  <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2.5 text-xs text-white rounded-xl focus:outline-none focus:border-[#0077C8] cursor-pointer"
                  >
                    <option value="">Destino direto por número</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name} ({ch.whatsappJid})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!selectedChannelId && (
                <div>
                  <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Telefone (com DDI e DDD)</label>
                  <input
                    type="text"
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(e.target.value)}
                    className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2.5 text-xs text-white rounded-xl focus:outline-none focus:border-[#0077C8] font-mono"
                    placeholder="5511999998888"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
              <button
                onClick={() => setDispatchModalStudy(null)}
                className="px-4 py-2.5 bg-[#1F2937] hover:bg-[#374151] text-white rounded-xl transition-colors text-xs font-semibold cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDispatchWhatsApp(dispatchModalStudy.id)}
                disabled={isDispatching}
                className="px-6 py-2.5 bg-[#0077C8] hover:bg-[#005F9E] text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow"
              >
                {isDispatching ? 'Enviando...' : 'Confirmar Envio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
