import React from 'react';
import { Download, Smartphone, X, Share2, PlusSquare } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall.ts';

interface PwaInstallButtonProps {
  variant?: 'sidebar' | 'header' | 'login';
  className?: string;
}

export const PwaInstallButton: React.FC<PwaInstallButtonProps> = ({ variant = 'sidebar', className = '' }) => {
  const { isInstalled, isIOS, showIOSModal, setShowIOSModal, installPwa } = usePwaInstall();

  if (isInstalled) return null;

  return (
    <>
      {variant === 'sidebar' && (
        <button
          onClick={installPwa}
          className={`w-full flex items-center justify-center gap-2 rounded-lg cursor-pointer transition-all text-xs font-semibold py-2 px-3 bg-[#0F2B5C] hover:bg-[#0077C8] text-white shadow ${className}`}
          title="Instalar aplicativo no dispositivo"
          aria-label="Instalar Teleios Admin como aplicativo"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Instalar Aplicativo</span>
        </button>
      )}

      {variant === 'header' && (
        <button
          onClick={installPwa}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0F2B5C]/80 hover:bg-[#0077C8] text-white transition-colors cursor-pointer border border-[#0077C8]/40 ${className}`}
          title="Instalar Teleios Admin no celular ou computador"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Instalar App</span>
        </button>
      )}

      {variant === 'login' && (
        <button
          type="button"
          onClick={installPwa}
          className={`w-full mt-3 flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-semibold border border-[#374151] hover:border-[#0077C8] text-[#9CA3AF] hover:text-white bg-[#1F2937]/50 hover:bg-[#1F2937] transition cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4 text-[#0077C8]" />
          <span>Instalar Aplicativo no Dispositivo</span>
        </button>
      )}

      {/* Modal Guiada para iOS (Safari) */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111827] border border-[#374151] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-[#374151] pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Smartphone className="w-4 h-4 text-[#0077C8]" />
                <span>Instalar no iPhone / iPad</span>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1 text-[#9CA3AF] hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Para instalar o painel administrativo do <strong className="text-white">Teleios Admin</strong> na tela inicial do seu dispositivo Apple:
            </p>

            <ol className="text-xs text-[#E5E7EB] space-y-2.5">
              <li className="flex items-start gap-2">
                <Share2 className="w-4 h-4 text-[#0077C8] shrink-0 mt-0.5" />
                <span>1. Toque no ícone de <strong>Compartilhar</strong> na barra inferior do Safari.</span>
              </li>
              <li className="flex items-start gap-2">
                <PlusSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>2. Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 text-center font-bold text-[#0077C8]">3.</span>
                <span>Toque em <strong>Adicionar</strong> no canto superior direito.</span>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 bg-[#0077C8] hover:bg-[#005F9E] text-white font-bold text-xs rounded-xl cursor-pointer transition mt-2"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
