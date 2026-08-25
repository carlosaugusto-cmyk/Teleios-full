import React from 'react';
import { Compass, Award, Heart } from 'lucide-react';
import { TeleiosLogo } from '../common/TeleiosLogo.tsx';

export const LandingSobre: React.FC = () => {
  return (
    <section id="sobre" className="py-16 space-y-12 scroll-mt-24">
      <div className="bg-secondary rounded-2xl border border-border-default p-8 sm:p-12 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-6">
          <span className="text-sm font-bold uppercase tracking-widest text-brand-gold">Nossa Identidade</span>
          
          <h2 className="text-4xl sm:text-5xl font-serif font-bold text-text-primary leading-tight">
            Nossa Missão
          </h2>

          <p className="text-lg text-text-secondary leading-relaxed font-sans">
            Conduzir pessoas a um relacionamento verdadeiro e transformador com Jesus Cristo, promovendo cura, restauração, amadurecimento espiritual e capacitação para o cumprimento do propósito de Deus.
          </p>

          <div className="pt-2">
            <div className="p-5 rounded-xl bg-tertiary border border-border-default font-serif italic text-base text-text-primary border-l-4 border-l-brand-gold">
              &ldquo;A fim de que o homem de Deus seja perfeito e perfeitamente habilitado para toda boa obra.&rdquo;
              <span className="block text-sm font-sans not-italic font-bold text-text-muted mt-2">
                — 2 Timóteo 3:17
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-tertiary/50 p-8 rounded-xl border border-border-default flex flex-col items-center justify-center text-center space-y-4">
          <TeleiosLogo size="md" />
          <p className="text-sm text-text-muted max-w-xs mt-4">
            O símbolo Teleios expressa o chamado à maturidade plena em Cristo e ao aperfeiçoamento contínuo em amor.
          </p>
        </div>
      </div>
    </section>
  );
};
