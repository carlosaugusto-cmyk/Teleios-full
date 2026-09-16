import React from 'react';
import { HeartHandshake, Users, ArrowRight } from 'lucide-react';

export const LandingHero: React.FC = () => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative py-8 sm:py-16 lg:py-20" aria-labelledby="hero-title">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
        {/* Text Column */}
        <div className="lg:col-span-7 space-y-6">
          <h1 id="hero-title" className="text-3xl sm:text-5xl lg:text-6xl font-serif text-white font-bold leading-[1.15] tracking-tight">
            Conduzindo vidas a um relacionamento <span className="text-[#0077C8] italic">verdadeiro</span> com Jesus Cristo.
          </h1>

          <p className="text-sm sm:text-lg text-[#D1D5DB] leading-relaxed font-sans max-w-2xl">
            Promovemos cura, restauração e amadurecimento espiritual através de uma comunidade acolhedora e ações sociais de impacto.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => scrollTo('contato')}
              className="px-5 py-3.5 sm:px-6 sm:py-4 bg-[#0F2B5C] hover:bg-[#0077C8] text-white font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 rounded-xl transition-colors shadow-md cursor-pointer border border-[#374151]"
            >
              <HeartHandshake className="w-5 h-5 text-[#F5A800]" />
              <span>Preciso de Acolhimento</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => scrollTo('projetos')}
              className="px-5 py-3.5 sm:px-6 sm:py-4 bg-[#F5A800] hover:bg-[#D97706] text-[#0A0F1A] font-bold text-xs sm:text-sm uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <Users className="w-5 h-5" />
              <span>Conhecer Projetos</span>
            </button>
          </div>

          {/* Metrics Bar — Responsive on 320px–430px */}
          <div className="pt-6 border-t border-[#374151] grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center p-2 rounded-xl bg-[#111827]/50 border border-[#374151]/40">
              <span className="block text-xl sm:text-3xl font-serif font-bold text-white">+1.200</span>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#9CA3AF] block mt-0.5">
                Vidas
              </span>
            </div>
            <div className="text-center p-2 rounded-xl bg-[#111827]/50 border border-[#374151]/40">
              <span className="block text-xl sm:text-3xl font-serif font-bold text-[#10B981]">+450</span>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#9CA3AF] block mt-0.5">
                Famílias
              </span>
            </div>
            <div className="text-center p-2 rounded-xl bg-[#111827]/50 border border-[#374151]/40">
              <span className="block text-xl sm:text-3xl font-serif font-bold text-[#0077C8]">100%</span>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#9CA3AF] block mt-0.5">
                Graça & Amor
              </span>
            </div>
          </div>
        </div>

        {/* Image Column */}
        <div className="lg:col-span-5 relative">
          <div className="rounded-2xl overflow-hidden shadow-xl aspect-square sm:aspect-video lg:aspect-auto lg:h-[520px] relative border border-[#374151]">
            <img
              src="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=80"
              alt="Comunidade Teleios em comunhão"
              loading="lazy"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1A] via-transparent to-transparent flex items-end p-6 sm:p-8">
              <div>
                <span className="text-white text-lg sm:text-xl font-bold font-serif block">Comunidade Teleios</span>
                <span className="text-white/80 text-xs sm:text-sm font-sans">Sendo aperfeiçoados em amor</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};