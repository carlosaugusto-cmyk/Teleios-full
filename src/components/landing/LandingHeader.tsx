import React, { useState } from 'react';
import { HeartHandshake, Menu, X } from 'lucide-react';
import { TeleiosLogo } from '../common/TeleiosLogo.tsx';

export const LandingHeader: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { id: 'sobre', label: 'Sobre' },
    { id: 'projetos', label: 'Projetos Sociais' },
    { id: 'contato', label: 'Contato' },
  ];

  const handleNav = (id: string) => {
    setMenuOpen(false);
    if (id === 'estudos') {
      window.location.href = '/midias?tab=estudos';
    } else {
      const section = document.getElementById(id);
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b shadow-sm transition-all bg-[#111827]/95 backdrop-blur-md border-border-default">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 sm:h-22">
          {/* Logo */}
          <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 cursor-pointer group py-2">
            <div className="w-12 sm:w-14 flex-shrink-0">
              <TeleiosLogo variant="icon" size="sm" className="group-hover:scale-105 transition duration-300" />
            </div>
            <div className="border-l border-border-default pl-3 hidden sm:block">
              <span className="text-xs font-serif font-bold uppercase tracking-widest text-text-muted block leading-none">MINISTÉRIO</span>
              <span className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-text-primary block leading-none italic">Teleios</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider">
            {navItems.map(item => (
              <button key={item.id} onClick={() => handleNav(item.id)} className="px-4 py-2.5 rounded-lg transition-colors text-text-secondary hover:text-text-primary hover:bg-tertiary">
                {item.label}
              </button>
            ))}
            <button onClick={() => handleNav('estudos')} className="px-4 py-2.5 rounded-lg transition-colors text-text-secondary hover:text-text-primary hover:bg-tertiary">
              Estudos
            </button>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button onClick={() => handleNav('contato')} className="px-5 py-3 bg-brand-green hover:bg-brand-green/90 text-text-inverse font-bold text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 transition-colors">
              <HeartHandshake className="w-5 h-5 text-brand-gold" />
              <span className="hidden sm:inline">Pedir Oração</span>
              <span className="sm:hidden">Oração</span>
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden p-2 text-text-secondary hover:text-text-primary">
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="relative flex flex-col w-64 max-w-sm h-full bg-secondary border-r border-border-default shadow-xl animate-fade-in-right">
            <div className="p-4 border-b border-border-default flex justify-between items-center">
              <span className="font-serif font-bold text-lg text-text-primary">Menu</span>
              <button onClick={() => setMenuOpen(false)} className="text-text-muted hover:text-text-primary"><X className="w-6 h-6"/></button>
            </div>
            <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
              {navItems.map(item => (
                <button key={item.id} onClick={() => handleNav(item.id)} className="px-4 py-3 rounded-lg text-left text-sm font-bold uppercase text-text-secondary hover:bg-tertiary hover:text-text-primary">
                  {item.label}
                </button>
              ))}
              <button onClick={() => handleNav('estudos')} className="px-4 py-3 rounded-lg text-left text-sm font-bold uppercase text-text-secondary hover:bg-tertiary hover:text-text-primary">
                Estudos
              </button>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};
