import React from 'react';
import { Settings, Server, Globe, Database, ShieldCheck, Cpu } from 'lucide-react';
import { SystemStatus } from '../../types/index.ts';

interface ConfiguracoesViewProps {
  systemStatus: SystemStatus | null;
  onRefreshStatus: () => void;
  currentUserId?: string;
  isSuperadmin?: boolean;
}

export const ConfiguracoesView: React.FC<ConfiguracoesViewProps> = ({
  systemStatus,
}) => {
  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 min-w-0 w-full">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-[#9CA3AF] shrink-0" />
          <span>Configurações do Sistema</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-[#111827] border border-[#374151] rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3.5 sm:mb-4 text-[#F5A800]">
            <Database className="w-5 h-5 sm:w-6 sm:h-6" />
            <h3 className="font-bold text-white text-base sm:text-lg">Google Drive</h3>
          </div>
          <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm">
            <p className="flex justify-between text-[#9CA3AF]">Status: <span className="text-emerald-400 font-medium">Conectado</span></p>
            <p className="flex justify-between text-[#9CA3AF]">Pasta Raiz: <span className="text-white font-mono">/Teleios</span></p>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#374151] rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3.5 sm:mb-4 text-[#0077C8]">
            <Cpu className="w-5 h-5 sm:w-6 sm:h-6" />
            <h3 className="font-bold text-white text-base sm:text-lg">Gemini AI</h3>
          </div>
          <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm">
            <p className="flex justify-between text-[#9CA3AF]">Status: <span className="text-emerald-400 font-medium">Online</span></p>
            <p className="flex justify-between text-[#9CA3AF]">Modelo: <span className="text-white font-mono truncate max-w-[140px]">gemini-1.5-flash</span></p>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#374151] rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3.5 sm:mb-4 text-[#10B981]">
            <Server className="w-5 h-5 sm:w-6 sm:h-6" />
            <h3 className="font-bold text-white text-base sm:text-lg">WhatsApp Agent</h3>
          </div>
          <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm">
            <p className="flex justify-between text-[#9CA3AF]">Status: <span className="text-emerald-400 font-medium">Online</span></p>
            <p className="flex justify-between text-[#9CA3AF]">Sessão: <span className="text-white font-mono">Ativa</span></p>
          </div>
        </div>
      </div>
    </div>
  );
};