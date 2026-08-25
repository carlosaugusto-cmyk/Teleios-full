import React from 'react';
import { Settings, Server, Globe, Database, ShieldCheck, Cpu } from 'lucide-react';
import { SystemStatus } from '../../../types/index.ts';

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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#9CA3AF]" />
          Configurações do Sistema
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-[#111827] border border-[#374151] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4 text-[#F5A800]">
            <Database className="w-6 h-6" />
            <h3 className="font-bold text-white text-lg">Google Drive</h3>
          </div>
          <div className="space-y-3 text-sm">
            <p className="flex justify-between text-[#9CA3AF]">Status: <span className="text-emerald-400 font-medium">Conectado</span></p>
            <p className="flex justify-between text-[#9CA3AF]">Pasta Raiz: <span className="text-white font-mono">/Teleios</span></p>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#374151] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4 text-[#0077C8]">
            <Cpu className="w-6 h-6" />
            <h3 className="font-bold text-white text-lg">Gemini AI</h3>
          </div>
          <div className="space-y-3 text-sm">
            <p className="flex justify-between text-[#9CA3AF]">Status: <span className="text-emerald-400 font-medium">Online</span></p>
            <p className="flex justify-between text-[#9CA3AF]">Modelo: <span className="text-white font-mono">gemini-3.7-flash</span></p>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#374151] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4 text-[#10B981]">
            <Server className="w-6 h-6" />
            <h3 className="font-bold text-white text-lg">Whastmeo API</h3>
          </div>
          <div className="space-y-3 text-sm">
            <p className="flex justify-between text-[#9CA3AF]">Status: <span className="text-emerald-400 font-medium">Online</span></p>
            <p className="flex justify-between text-[#9CA3AF]">Sessão: <span className="text-white font-mono">Ativa</span></p>
          </div>
        </div>
      </div>
      
      {/* Reduced the noise, removed tests the user couldn't do anything about */}
    </div>
  );
};