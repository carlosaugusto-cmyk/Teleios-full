import React from 'react';
import { ChevronRight } from 'lucide-react';
import { TeleiosLogo } from '../../components/common/TeleiosLogo.tsx';
import { LandingHeader } from '../../components/landing/LandingHeader.tsx';
import { LandingHero } from '../../components/landing/LandingHero.tsx';
import { LandingSobre } from '../../components/landing/LandingSobre.tsx';
import { LandingProjetos } from '../../components/landing/LandingProjetos.tsx';
import { LandingContato } from '../../components/landing/LandingContato.tsx';

// We keep these props to satisfy PublicRoute requirements, even if not strictly used in the new component tree,
// but they might be useful if we add preview sections later.
interface LandingPageProps {
  studies?: any[];
  galeriaFiles?: any[];
  videos?: any[];
  onOpenAdmin: (targetTab?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAdmin }) => {
  return (
    <div className="bg-primary text-primary min-h-screen flex flex-col font-sans" style={{ backgroundColor: '#0A0F1A', color: '#F9FAFB' }}>

      <LandingHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-24 pb-24">
        <LandingHero />
        <LandingSobre />
        <LandingProjetos />
        <LandingContato />
      </main>

      <footer className="bg-secondary border-t border-border-default py-10 mt-16 text-text-muted text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TeleiosLogo variant="icon" size="sm" />
                <span className="font-serif font-bold text-lg text-text-primary italic">Ministério Teleios</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                Conduzindo pessoas a um relacionamento verdadeiro e transformador com Jesus Cristo, por meio da Palavra, do discipulado, da oração e do cuidado integral.
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-bold uppercase tracking-wider text-text-primary block text-sm">Navegação</span>
              <ul className="space-y-1 text-sm">
                <li><a href="#sobre" className="hover:text-brand-gold transition-colors flex items-center gap-1"><ChevronRight className="w-3.5 h-3.5" /> Nossa Missão</a></li>
                <li><a href="#projetos" className="hover:text-brand-gold transition-colors flex items-center gap-1"><ChevronRight className="w-3.5 h-3.5" /> Projetos Sociais</a></li>
                <li><a href="#contato" className="hover:text-brand-gold transition-colors flex items-center gap-1"><ChevronRight className="w-3.5 h-3.5" /> Contato</a></li>
              </ul>
            </div>

            <div className="space-y-2">
              <span className="font-bold uppercase tracking-wider text-text-primary block text-sm">Conteúdos & Mídias</span>
              <ul className="space-y-1 text-sm">
                <li><a href="/midias?tab=estudos" className="hover:text-brand-gold transition-colors flex items-center gap-1"><ChevronRight className="w-3.5 h-3.5" /> Estudos Bíblicos</a></li>
                <li><a href="/midias?tab=videos" className="hover:text-brand-gold transition-colors flex items-center gap-1"><ChevronRight className="w-3.5 h-3.5" /> Vídeos & YouTube</a></li>
                <li><a href="/midias?tab=galeria" className="hover:text-brand-gold transition-colors flex items-center gap-1"><ChevronRight className="w-3.5 h-3.5" /> Galeria de Fotos</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-border-default flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-text-muted">
            <span>© 2026 Ministério Teleios • Todos os direitos reservados.</span>
            <p className="font-serif text-sm text-brand-gold italic text-center sm:text-right">"Até que todos alcancemos a medida da estatura da plenitude de Cristo." — Efésios 4:13</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
