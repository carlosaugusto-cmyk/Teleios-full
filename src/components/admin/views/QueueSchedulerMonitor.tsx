import React, { useState } from 'react';
import { Activity, Clock, CheckCircle2 } from 'lucide-react';
import { SystemStatus } from '../../../types/index.ts';
import { apiFetch } from '../../../services/api.service.ts';

interface QueueSchedulerMonitorProps {
  systemStatus: SystemStatus | null;
  onRefresh: () => void;
}

export const QueueSchedulerMonitor: React.FC<QueueSchedulerMonitorProps> = ({ onRefresh }) => {
  const [cronMessage, setCronMessage] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const handleTriggerCronManual = async () => {
    setIsTriggering(true);
    try {
      const res = await apiFetch('/api/scheduler/cron-trigger', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCronMessage(`Varredura executada com sucesso!`);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTriggering(false);
      setTimeout(() => setCronMessage(null), 4000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-[#10B981]" />
          Automações e Filas
        </h2>
        <button
          onClick={handleTriggerCronManual}
          disabled={isTriggering}
          className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white font-bold rounded-lg transition-colors flex items-center gap-2"
        >
          <Clock className="w-4 h-4" />
          {isTriggering ? 'Executando...' : 'Forçar Varredura (Cron)'}
        </button>
      </div>

      {cronMessage && (
        <div className="p-4 bg-emerald-900/30 border border-emerald-800 text-emerald-400 rounded-lg flex items-center gap-2 mb-6">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{cronMessage}</span>
        </div>
      )}

      <div className="bg-[#111827] border border-[#374151] rounded-xl p-6 text-center text-[#9CA3AF]">
        <Activity className="w-12 h-12 mx-auto mb-4 opacity-50 text-[#10B981]" />
        <p className="text-lg font-medium text-white mb-2">Sistema em Operação Normal</p>
        <p className="text-sm">Os disparos automáticos para o WhatsApp ocorrem diariamente às 12:00 e 18:00.</p>
      </div>
    </div>
  );
};
