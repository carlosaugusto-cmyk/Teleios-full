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
    <section id="projetos" className="py-16 space-y-12 scroll-mt-24">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-sm font-bold uppercase tracking-widest text-brand-gold">Solidariedade & Amor</span>
        <h2 className="text-4xl sm:text-5xl font-serif font-bold text-text-primary">
          Projetos Sociais
        </h2>
        <p className="text-base text-text-secondary">
          A fé que transforma vidas se expressa em atos concretos de amor e cuidado ao próximo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {socialProjects.map((proj) => (
          <div key={proj.id} className="bg-secondary rounded-2xl border border-border-default p-8 shadow-sm hover:shadow-lg transition-all flex flex-col h-full text-center">
            <div className="w-16 h-16 rounded-full bg-brand-gold/10 text-brand-gold flex items-center justify-center mx-auto mb-6">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="font-serif font-bold text-2xl text-text-primary mb-4">{proj.title}</h3>
            <p className="text-base text-text-secondary leading-relaxed flex-1">{proj.description}</p>
            <div className="pt-6 mt-6 border-t border-border-default">
              <span className="font-bold text-brand-green">{proj.impact}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
