import React, { useState } from 'react';
import { Sparkles, MessageSquare, RefreshCw, Send, Image as ImageIcon, FileText, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Study } from '../../../types/index.ts';
import { apiFetch } from '../../../services/api.service.ts';

interface EstudosViewProps {
  studies: Study[];
  onRefresh: () => void;
}

export const EstudosView: React.FC<EstudosViewProps> = ({ studies, onRefresh }) => {
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [dispatchModalStudy, setDispatchModalStudy] = useState<Study | null>(null);
  const [targetPhone, setTargetPhone] = useState<string>('5511999998888');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

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
      const res = await apiFetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyId, targetPhone }),
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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-[#0077C8]" />
          Estudos
        </h2>
        <button
          onClick={onRefresh}
          className="p-2 bg-[#1F2937] hover:bg-[#374151] text-white rounded-lg transition-colors border border-[#374151]"
          title="Atualizar"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {feedback && (
        <div className="p-4 bg-emerald-900/30 border border-emerald-800 text-emerald-400 rounded-lg flex items-center gap-2 mb-6">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{feedback}</span>
        </div>
      )}

      {studies.length === 0 ? (
        <div className="text-center py-20 bg-[#111827] border border-[#374151] rounded-xl text-[#9CA3AF]">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-white">Nenhum estudo encontrado.</p>
          <p className="text-sm mt-1">Crie um novo estudo na aba "Novo Arquivo".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {studies.map((study) => (
            <div key={study.id} className="bg-[#111827] border border-[#374151] rounded-xl overflow-hidden flex flex-col h-full">
              {/* Image Preview */}
              <div className="h-40 bg-black relative">
                <img
                  src={study.generatedImgUrl || study.aiImageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'}
                  alt="Imagem do estudo"
                  className="w-full h-full object-cover opacity-80"
                />
              </div>

              {/* Content */}
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-lg text-white mb-2 line-clamp-1" title={study.mediaFile?.originalName || study.title}>
                  {study.title || study.mediaFile?.originalName || 'Estudo sem título'}
                </h3>
                <p className="text-sm text-[#9CA3AF] line-clamp-3 flex-1 mb-4">
                  {study.summary || 'Resumo ainda não processado...'}
                </p>
                
                {/* Actions */}
                <div className="pt-4 border-t border-[#374151] flex items-center gap-2">
                  <button
                    onClick={() => setDispatchModalStudy(study)}
                    className="flex-1 py-2 bg-[#0077C8] hover:bg-[#005F9E] text-white text-sm font-bold rounded-lg transition-colors flex justify-center items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Enviar WhatsApp
                  </button>
                  <button
                    onClick={() => handleReprocessAI(study.id)}
                    disabled={isProcessingId === study.id}
                    className="p-2 bg-[#1F2937] hover:bg-[#374151] text-white border border-[#374151] rounded-lg transition-colors"
                    title="Reprocessar IA"
                  >
                    <RefreshCw className={`w-4 h-4 ${isProcessingId === study.id ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchModalStudy && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#374151] rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-white mb-2">Enviar via WhatsApp</h3>
            <p className="text-[#9CA3AF] text-sm mb-6">Confirme o número para enviar o resumo e a imagem.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-1">Telefone (com DDI e DDD)</label>
                <input
                  type="text"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  className="w-full bg-[#1F2937] border border-[#374151] px-4 py-3 text-white rounded-lg focus:outline-none focus:border-[#0077C8]"
                  placeholder="5511999998888"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setDispatchModalStudy(null)}
                className="px-4 py-2 bg-[#1F2937] hover:bg-[#374151] text-white rounded-lg transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDispatchWhatsApp(dispatchModalStudy.id)}
                disabled={isDispatching}
                className="px-6 py-2 bg-[#0077C8] hover:bg-[#005F9E] text-white font-bold rounded-lg transition-colors flex items-center gap-2"
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
