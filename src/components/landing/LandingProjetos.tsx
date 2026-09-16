import React from 'react';
import { Users } from 'lucide-react';

export const LandingProjetos: React.FC = () => {
  const socialProjects = [
    {
      id: 'mesa-solidaria',
      title: 'Mesa Solidária',
      description: 'Distribuição de alimentos e kits de higiene para famílias em vulnerabilidade, expressando o amor de Cristo em ação concreta.',
      impact: '+1.200 cestas distribuídas',
    },
    {
      id: 'acolhimento-familia',
      title: 'Projeto Acolher & Restaurar',
      description: 'Atendimento pastoral e aconselhamento para indivíduos e famílias em momentos de crise, restaurando vidas.',
      impact: '+450 famílias atendidas neste ano',
    },
    {
      id: 'capacitacao-oficinas',
      title: 'Oficinas de Futuro',
      description: 'Capacitação de jovens e adultos para descobrir seus dons, identidade e chamado em Cristo através do ensino profissional.',
      impact: '180 jovens capacitados',
    },
  ];

  return (
    <section id="projetos" className="py-12 sm:py-16 space-y-10 scroll-mt-24">
      <div className="text-center max-w-3xl mx-auto space-y-3 px-2">
        <span className="text-xs font-bold uppercase tracking-widest text-[#F5A800]">Solidariedade & Amor</span>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-white">
          Projetos Sociais
        </h2>
        <p className="text-sm sm:text-base text-[#9CA3AF]">
          A fé que transforma vidas se expressa em atos concretos de amor e cuidado ao próximo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {socialProjects.map((proj) => (
          <div
            key={proj.id}
            className="bg-[#111827] rounded-2xl border border-[#374151] p-6 sm:p-8 shadow-sm hover:border-[#F5A800]/50 transition-all flex flex-col h-full text-center"
          >
            <div className="w-14 h-14 rounded-full bg-[#F5A800]/10 text-[#F5A800] flex items-center justify-center mx-auto mb-5">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="font-serif font-bold text-xl text-white mb-3">{proj.title}</h3>
            <p className="text-xs sm:text-sm text-[#D1D5DB] leading-relaxed flex-1">{proj.description}</p>
            <div className="pt-5 mt-5 border-t border-[#374151]">
              <span className="font-bold text-xs uppercase tracking-wider text-[#10B981]">{proj.impact}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};