import React from 'react';
import { TeleiosLogo } from '../common/TeleiosLogo.tsx';

export const LandingSobre: React.FC = () => {
  return (
    <section id="sobre" className="py-12 sm:py-16 space-y-12 scroll-mt-24">
      <div className="bg-[#111827] rounded-2xl border border-[#374151] p-6 sm:p-10 lg:p-12 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-6">
          <span className="text-xs font-bold uppercase tracking-widest text-[#F5A800]">Nossa Identidade</span>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-white leading-tight">
            Nossa Missão
          </h2>

          <p className="text-sm sm:text-base text-[#D1D5DB] leading-relaxed font-sans">
            Conduzir pessoas a um relacionamento verdadeiro e transformador com Jesus Cristo, promovendo cura, restauração, amadurecimento espiritual e capacitação para o cumprimento do propósito de Deus.
          </p>

          <div className="pt-2">
            <div className="p-4 sm:p-5 rounded-xl bg-[#1F2937] border border-[#374151] font-serif italic text-sm sm:text-base text-white border-l-4 border-l-[#F5A800]">
              &ldquo;A fim de que o homem de Deus seja perfeito e perfeitamente habilitado para toda boa obra.&rdquo;
              <span className="block text-xs sm:text-sm font-sans not-italic font-bold text-[#9CA3AF] mt-2">
                — 2 Timóteo 3:17
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#1F2937]/60 p-6 sm:p-8 rounded-2xl border border-[#374151] flex flex-col items-center justify-center text-center space-y-4">
          <TeleiosLogo size="md" />
          <p className="text-xs sm:text-sm text-[#9CA3AF] max-w-xs mt-4">
            O símbolo Teleios expressa o chamado à maturidade plena em Cristo e ao aperfeiçoamento contínuo em amor.
          </p>
        </div>
      </div>
    </section>
  );
};