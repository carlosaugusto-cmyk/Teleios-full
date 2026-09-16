import React, { useState } from 'react';
import { Heart, Send, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, Phone, User } from 'lucide-react';
import confetti from 'canvas-confetti';

export const LandingContato: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', text: 'Por favor, informe seu nome.' });
      return;
    }
    if (!phone.trim()) {
      setFeedback({ type: 'error', text: 'Por favor, informe seu número de telefone/WhatsApp.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('https://teleios-api-worker.ca88321499.workers.dev/api/leads/oracao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
        setFeedback({
          type: 'success',
          text: 'Seu pedido de oração foi recebido! Nossa equipe e pastores estarão intercedendo por você.',
        });
        setName('');
        setPhone('');
      } else {
        setFeedback({ type: 'error', text: json.error || 'Erro ao enviar pedido de oração.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Erro de conexão ao enviar pedido. Verifique sua conexão.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contato" className="scroll-mt-24">
      <div id="oracao" className="bg-[#0A0F1A] border border-[#374151] rounded-3xl p-6 sm:p-12 shadow-2xl space-y-8 scroll-mt-24">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-950/70 border border-blue-800 text-blue-300 text-xs font-bold uppercase tracking-wider">
          <Heart className="w-3.5 h-3.5 fill-blue-400 text-blue-400" />
          <span>Intercessão & Oração</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-serif font-bold text-white tracking-tight">
          Precisa de Oração?
        </h2>
        <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
          Informe apenas seu nome e telefone. Estaremos orando por você e sua família. É rápido e sigiloso.
        </p>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-2.5 animate-fade-in max-w-lg mx-auto ${feedback.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
            : 'bg-rose-950/80 border-rose-800 text-rose-300'
            }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Form ultra-simplificado: Nome + Telefone -> Enviar */}
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
            Seu Nome Completo *
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como podemos te chamar?"
              className="w-full pl-10 pr-4 py-3.5 bg-[#1F2937] border border-[#374151] rounded-xl text-xs text-white placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#0077C8]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
            Número de Telefone / WhatsApp *
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full pl-10 pr-4 py-3.5 bg-[#1F2937] border border-[#374151] rounded-xl text-xs text-white placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#0077C8]"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-[#0077C8] hover:bg-[#005F9E] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Enviando Pedido...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Enviar Pedido de Oração</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF] justify-center pt-1">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>Seus dados são confidenciais e utilizados exclusivamente para intercessão.</span>
        </div>
      </form>
      </div>
    </section>
  );
};
