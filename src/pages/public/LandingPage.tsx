import React from 'react';
import { ChevronRight } from 'lucide-react';
import { TeleiosLogo } from '../../components/common/TeleiosLogo.tsx';
import { LandingHeader } from '../../components/landing/LandingHeader.tsx';
import { LandingHero } from '../../components/landing/LandingHero.tsx';
import { LandingSobre } from '../../components/landing/LandingSobre.tsx';
import { LandingProjetos } from '../../components/landing/LandingProjetos.tsx';
import { LandingContato } from '../../components/landing/LandingContato.tsx';
import { DevocionaisSection } from '../../components/media/DevocionaisSection.tsx';
import { VideosSection } from '../../components/media/VideosSection.tsx';
import { GaleriaSection } from '../../components/media/GaleriaSection.tsx';
import { Study, MediaFile, VideoMetadata } from '../../types/index.ts';

interface LandingPageProps {
  studies?: Study[];
  galeriaFiles?: MediaFile[];
  videos?: VideoMetadata[];
  isLoading?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  studies = [],
  galeriaFiles = [],
  videos = [],
  isLoading = false,
}) => {
  React.useEffect(() => {
    const handleHashScroll = () => {
      if (window.location.hash) {
        const id = window.location.hash.replace('#', '');
        const targetId = (id === 'oracao' || id === 'contato') ? 'contato' : id;
        setTimeout(() => {
          const el = document.getElementById(targetId) || document.getElementById('oracao') || document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    };
    handleHashScroll();
    window.addEventListener('hashchange', handleHashScroll);
    return () => window.removeEventListener('hashchange', handleHashScroll);
  }, []);

  return (
    <div className="bg-[#0A0F1A] text-[#F9FAFB] min-h-screen flex flex-col font-sans">
      <LandingHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-16 sm:space-y-24 pb-20">
        <LandingHero />
        <LandingSobre />
        <LandingProjetos />

        {/* ── Seção de Devocionais e Estudos Bíblicos ── */}
        <div id="devocionais" className="scroll-mt-24">
          <DevocionaisSection
            devocionais={studies}
            isLoading={isLoading}
          />
        </div>

        {/* ── Catálogo Unificado de Mídias (Vídeos e Galeria) ── */}
        <div id="midias" className="scroll-mt-24 space-y-16 sm:space-y-24">
          <VideosSection
            videos={videos}
            isLoading={isLoading}
          />
          <GaleriaSection
            galeriaFiles={galeriaFiles}
            isLoading={isLoading}
          />
        </div>

        <LandingContato />
      </main>

      <footer className="bg-[#111827] border-t border-[#374151] py-10 mt-12 text-[#9CA3AF] text-xs sm:text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TeleiosLogo variant="icon" size="sm" />
                <span className="font-serif font-bold text-base sm:text-lg text-white italic">Ministério Teleios</span>
              </div>
              <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
                Conduzindo pessoas a um relacionamento verdadeiro e transformador com Jesus Cristo, por meio da Palavra, do discipulado, da oração e do cuidado integral.
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-bold uppercase tracking-wider text-white block text-xs">Navegação</span>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <a href="#sobre" className="hover:text-[#F5A800] transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3.5 h-3.5" /> Nossa Missão
                  </a>
                </li>
                <li>
                  <a href="#projetos" className="hover:text-[#F5A800] transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3.5 h-3.5" /> Projetos Sociais
                  </a>
                </li>
                <li>
                  <a href="#contato" className="hover:text-[#F5A800] transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3.5 h-3.5" /> Contato & Oração
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <span className="font-bold uppercase tracking-wider text-white block text-xs">Conteúdos & Mídias</span>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <a href="#devocionais" className="hover:text-[#F5A800] transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3.5 h-3.5" /> Devocionais Bíblicos
                  </a>
                </li>
                <li>
                  <a href="#midias" className="hover:text-[#F5A800] transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3.5 h-3.5" /> Vídeos & Mensagens
                  </a>
                </li>
                <li>
                  <a href="#midias" className="hover:text-[#F5A800] transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3.5 h-3.5" /> Galeria de Fotos
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-[#374151] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-[#9CA3AF]">
            <span>© {new Date().getFullYear()} Ministério Teleios • Todos os direitos reservados.</span>
            <p className="font-serif text-xs text-[#F5A800] italic text-center sm:text-right">
              "Até que todos alcancemos a medida da estatura da plenitude de Cristo." — Efésios 4:13
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};