import React, { useState } from 'react';
import { Mail, Send, MapPin, Clock, CheckCircle2 } from 'lucide-react';

export const LandingContato: React.FC = () => {
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  const handleSubmitContact = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setTimeout(() => {
      setFormSubmitted(false);
      (e.target as HTMLFormElement).reset();
    }, 4000);
  };

  return (
    <section id="contato" className="py-16 space-y-12 scroll-mt-24">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-sm font-bold uppercase tracking-widest text-brand-blue">Comunicação Direta</span>
        <h2 className="text-4xl sm:text-5xl font-serif font-bold text-text-primary">
          Estamos Prontos para Ouvir Você
        </h2>
        <p className="text-base text-text-secondary">
          Preencha o formulário abaixo ou use os canais diretos para pedir oração ou mais informações.
        </p>
      </div>

      <div className="bg-secondary rounded-2xl border border-border-default p-6 sm:p-8 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h3 className="font-serif font-bold text-xl text-text-primary">Envie sua Mensagem</h3>

          {formSubmitted && (
            <div className="p-4 rounded-lg bg-brand-green/10 border border-brand-green/30 text-brand-green flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">Mensagem enviada com sucesso!</span>
            </div>
          )}

          <form onSubmit={handleSubmitContact} className="space-y-5" noValidate>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Nome Completo</label>
              <input required type="text" className="w-full px-4 py-3 bg-tertiary border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Telefone/WhatsApp</label>
              <input required type="tel" className="w-full px-4 py-3 bg-tertiary border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue" />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Assunto</label>
              <select className="w-full px-4 py-3 bg-tertiary border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue">
                <option value="acolhimento">Pedido de Oração & Acolhimento</option>
                <option value="projetos">Projetos Sociais</option>
                <option value="outro">Outro Assunto</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Mensagem</label>
              <textarea required rows={4} className="w-full px-4 py-3 bg-tertiary border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue"></textarea>
            </div>

            <button type="submit" disabled={formSubmitted} className="w-full sm:w-auto px-8 py-4 bg-brand-blue hover:bg-brand-blue/90 text-white font-bold text-sm uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-colors">
              <Send className="w-5 h-5" />
              <span>Enviar Mensagem</span>
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <h3 className="font-serif font-bold text-xl text-text-primary">Canais Diretos</h3>

          <div className="space-y-4">
            <a href="https://wa.me/5511999999999" target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 bg-tertiary rounded-xl border border-border-default hover:border-brand-green/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-brand-green/10 text-brand-green flex items-center justify-center"><Send className="w-6 h-6" /></div>
              <div>
                <h4 className="font-semibold text-text-primary">WhatsApp Direto</h4>
                <p className="text-sm text-text-secondary">Atendimento rápido para oração.</p>
              </div>
            </a>

            <a href="mailto:contato@teleios.org.br" className="flex items-center gap-4 p-4 bg-tertiary rounded-xl border border-border-default hover:border-brand-blue/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center"><Mail className="w-6 h-6" /></div>
              <div>
                <h4 className="font-semibold text-text-primary">E-mail</h4>
                <p className="text-sm text-text-secondary">contato@teleios.org.br</p>
              </div>
            </a>

            <div className="flex items-center gap-4 p-4 bg-tertiary rounded-xl border border-border-default">
              <div className="w-12 h-12 rounded-lg bg-brand-gold/10 text-brand-gold flex items-center justify-center"><MapPin className="w-6 h-6" /></div>
              <div>
                <h4 className="font-semibold text-text-primary">Endereço</h4>
                <p className="text-sm text-text-secondary">Rua da Esperança, 123 — Centro</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border-default">
            <h4 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-gold" />
              Horários
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-text-secondary">
              <div><span className="font-medium text-text-primary">Seg–Sex:</span> 09h–18h</div>
              <div><span className="font-medium text-text-primary">Domingos:</span> 09h30 / 19h</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
