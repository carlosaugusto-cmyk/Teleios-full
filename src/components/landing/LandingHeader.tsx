import React, { useState } from 'react';
import { HeartHandshake, Menu, X, BookOpen, Image as ImageIcon, Heart } from 'lucide-react';
import { TeleiosLogo } from '../common/TeleiosLogo.tsx';
import { DonationModal } from '../donation/DonationModal.tsx';

export const LandingHeader: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [donationOpen, setDonationOpen] = useState(false);

  const navItems = [
    { id: 'sobre', label: 'Sobre' },
    { id: 'projetos', label: 'Projetos Sociais' },
    { id: 'devocionais', label: 'Devocionais' },
    { id: 'midias', label: 'Mídias' },
    { id: 'contato', label: 'Oração' },
  ];

  const handleNav = (id: string) => {
    setMenuOpen(false);
    const targetId = (id === 'oracao' || id === 'contato') ? 'contato' : id;
    const cleanPath = window.location.pathname.replace(/\/+$/, '');
    if (cleanPath !== '' && cleanPath !== '/index.html') {
      window.location.href = `/#${targetId}`;
      return;
    }
    const section = document.getElementById(targetId) || document.getElementById('oracao') || document.getElementById(id);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState(null, '', `/#${targetId}`);
    } else {
      window.location.href = `/#${targetId}`;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b shadow-sm transition-all bg-[#0A0F1A]/95 backdrop-blur-md border-[#374151]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div
              onClick={() => {
                const cleanPath = window.location.pathname.replace(/\/+$/, '');
                if (cleanPath !== '' && cleanPath !== '/index.html') {
                  window.location.href = '/';
                } else {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group py-2"
            >
              <div className="w-10 sm:w-12 flex-shrink-0">
                <TeleiosLogo variant="icon" size="sm" className="group-hover:scale-105 transition duration-300" />
              </div>
              <div className="border-l border-[#374151] pl-2.5 sm:pl-3">
                <span className="text-[10px] sm:text-xs font-serif font-bold uppercase tracking-widest text-[#9CA3AF] block leading-none">
                  MINISTÉRIO
                </span>
                <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white block leading-tight italic">
                  Teleios
                </span>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className="px-3.5 py-2 rounded-lg transition-colors text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Botão Doação Desktop */}
              <button
                type="button"
                onClick={() => setDonationOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/70 text-emerald-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                <Heart className="w-3.5 h-3.5 fill-emerald-400/30 text-emerald-400" />
                <span>Quero fazer uma doação</span>
              </button>

              <button
                onClick={() => handleNav('contato')}
                className="px-3.5 py-2 sm:px-5 sm:py-2.5 bg-[#009B77] hover:bg-[#008060] text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer shadow"
              >
                <HeartHandshake className="w-4 h-4 text-[#F5A800]" />
                <span className="hidden sm:inline">Pedir Oração</span>
                <span className="sm:hidden text-[11px]">Oração</span>
              </button>

              {/* Hamburger Button for Mobile */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Abrir Menu"
                className="lg:hidden p-2 rounded-xl bg-[#1F2937] border border-[#374151] text-[#9CA3AF] hover:text-white transition cursor-pointer"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Backdrop */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 lg:hidden transition-opacity"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed top-0 bottom-0 right-0 w-72 max-w-[85vw] bg-[#111827] border-l border-[#374151] shadow-2xl z-50 lg:hidden flex flex-col transform transition-transform duration-300 ease-in-out ${
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#374151] flex justify-between items-center bg-[#0A0F1A]">
          <div className="flex items-center gap-2">
            <TeleiosLogo variant="icon" size="sm" />
            <span className="font-serif font-bold text-base text-white italic">Navegação</span>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar Menu"
            className="p-1.5 rounded-lg bg-[#1F2937] text-[#9CA3AF] hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Links */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-2 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setDonationOpen(true);
            }}
            className="w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-950/40 border border-emerald-800/70 text-emerald-300 hover:bg-emerald-900/60 transition flex items-center gap-2.5 cursor-pointer shadow-sm mb-1"
          >
            <Heart className="w-4 h-4 fill-emerald-400/30 text-emerald-400 shrink-0" />
            <span>Quero fazer uma doação</span>
          </button>

          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className="w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] transition cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-[#374151] bg-[#0A0F1A] text-center">
          <p className="text-[11px] text-[#9CA3AF] font-serif italic">
            "Aperfeiçoados em amor"
          </p>
        </div>
      </div>

      {/* Modal de Doação */}
      <DonationModal isOpen={donationOpen} onClose={() => setDonationOpen(false)} />
    </>
  );
};