import React from 'react';
import { HeartHandshake, Users, ArrowRight } from 'lucide-react';

export const LandingHero: React.FC = () => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative py-12 sm:py-20" aria-labelledby="hero-title">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
        <div className="lg:col-span-7 space-y-6">
          <h1 id="hero-title" className="text-4xl sm:text-5xl lg:text-6xl font-serif text-text-primary font-bold leading-[1.12] tracking-tight">
            Conduzindo vidas a um relacionamento <span className="text-brand-blue italic">verdadeiro</span> com Jesus Cristo.
          </h1>

          <p className="text-lg sm:text-xl text-text-secondary leading-relaxed font-sans max-w-2xl">
            Promovemos cura, restauração e amadurecimento espiritual através de uma comunidade acolhedora e ações sociais de impacto.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => scrollTo('contato')}
              className="px-6 py-4 bg-brand-navy hover:bg-brand-navy/90 text-text-inverse font-bold text-sm uppercase tracking-wider flex items-center gap-3 rounded-lg transition-colors shadow-md"
            >
              <HeartHandshake className="w-5 h-5 text-brand-gold" />
              <span>Preciso de Acolhimento</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => scrollTo('projetos')}
              className="px-6 py-4 bg-brand-gold hover:bg-brand-gold/90 text-text-inverse font-bold text-sm uppercase tracking-wider rounded-lg flex items-center gap-2 transition-colors shadow-sm"
            >
              <Users className="w-5 h-5" />
              <span>Conhecer Projetos</span>
            </button>
          </div>

          <div className="pt-6 border-t border-border-default grid grid-cols-3 gap-4">
            <div className="text-center">
              <span className="block text-3xl sm:text-4xl font-serif font-bold text-text-primary">+1.200</span>
              <span className="text-sm font-bold uppercase tracking-wider text-text-muted">Vidas Restauradas</span>
            </div>
            <div className="text-center">
              <span className="block text-3xl sm:text-4xl font-serif font-bold text-brand-green">+450</span>
              <span className="text-sm font-bold uppercase tracking-wider text-text-muted">Famílias Discipuladas</span>
            </div>
            <div className="text-center">
              <span className="block text-3xl sm:text-4xl font-serif font-bold text-brand-blue">100%</span>
              <span className="text-sm font-bold uppercase tracking-wider text-text-muted">Graça & Amor</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 relative">
          <div className="rounded-2xl overflow-hidden shadow-xl aspect-square lg:aspect-auto lg:h-[600px] relative">
            <img
              src="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=80"
              alt="Comunhão"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-8">
              <div>
                <span className="text-white text-xl font-bold font-serif block">Comunidade Teleios</span>
                <span className="text-white/80 text-sm font-sans">Sendo aperfeiçoados em amor</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
