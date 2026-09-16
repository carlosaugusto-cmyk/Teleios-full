import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Heart,
  Search,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Phone,
  Calendar,
  ExternalLink,
  Trash2,
  Eye,
  Check,
  Filter,
  DollarSign,
  FileText,
  Clock,
} from 'lucide-react';
import { Lead, LeadType, LeadStatus } from '../../types/index.ts';
import { apiFetch } from '../../services/api.service.ts';

function formatDateTime(isoString?: string | null) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    const day = d.toLocaleDateString('pt-BR');
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${day} — ${time}`;
  } catch {
    return '—';
  }
}

export const InscricoesView: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'TODOS' | LeadType>('TODOS');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | LeadStatus>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modais
  const [receiptModalUrl, setReceiptModalUrl] = useState<string | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Lead | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadLeads = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/leads');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setLeads(json.data);
      } else {
        setLeads([]);
      }
    } catch {
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleUpdateStatus = async (leadId: string, newStatus: LeadStatus) => {
    setUpdatingId(leadId);
    try {
      const res = await apiFetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        showFeedback('success', `Status alterado para ${newStatus}.`);
        loadLeads();
      } else {
        showFeedback('error', json.error || 'Erro ao atualizar status.');
      }
    } catch {
      showFeedback('error', 'Erro de conexão ao atualizar status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      const res = await apiFetch(`/api/leads/${deleteConfirmItem.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        showFeedback('success', 'Inscrição excluída com sucesso.');
        setDeleteConfirmItem(null);
        loadLeads();
      } else {
        showFeedback('error', json.error || 'Erro ao excluir.');
      }
    } catch {
      showFeedback('error', 'Erro de conexão ao excluir.');
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((item) => {
      const matchesType = activeTab === 'TODOS' || item.type === activeTab;
      const matchesStatus = statusFilter === 'TODOS' || item.status === statusFilter;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        item.name.toLowerCase().includes(term) ||
        item.phone.includes(term);

      return matchesType && matchesStatus && matchesSearch;
    });
  }, [leads, activeTab, statusFilter, searchTerm]);

  const counts = useMemo(() => {
    return {
      TODOS: leads.length,
      pedido_oracao: leads.filter((l) => l.type === 'pedido_oracao').length,
      doacao: leads.filter((l) => l.type === 'doacao').length,
    };
  }, [leads]);

  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case 'CONFIRMADO':
      case 'ATENDIDO':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/80 border border-emerald-800 text-emerald-400">
            {status}
          </span>
        );
      case 'CANCELADO':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950/80 border border-rose-800 text-rose-400">
            Cancelado
          </span>
        );
      case 'PENDENTE':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/80 border border-amber-800 text-amber-400">
            Pendente
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto font-sans pb-16 min-w-0 w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-serif font-bold text-white tracking-tight flex items-center gap-2 sm:gap-2.5">
            <UserCheck className="w-6 h-6 sm:w-7 sm:h-7 text-[#0077C8] shrink-0" />
            <span>Inscrições & Leads</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#9CA3AF] mt-1 leading-relaxed">
            Gestão de pedidos de oração e confirmações de doações registradas através da Landing Page.
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:self-auto self-end">
          <button
            onClick={loadLeads}
            disabled={isLoading}
            className="p-2.5 bg-[#1F2937] hover:bg-[#374151] border border-[#374151] rounded-xl text-[#9CA3AF] hover:text-white transition cursor-pointer shrink-0"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 sm:p-4 rounded-xl border text-xs font-medium flex items-center gap-2.5 animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/80 border-rose-800 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="leading-snug">{feedback.text}</span>
        </div>
      )}

      {/* Tabs Bar - Scroll horizontal suave no mobile */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-[#374151] pb-3 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
        {[
          { id: 'TODOS', label: 'Todas as Inscrições', count: counts.TODOS },
          { id: 'pedido_oracao', label: 'Pedidos de Oração', count: counts.pedido_oracao },
          { id: 'doacao', label: 'Doações & Apoio', count: counts.doacao },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                isActive
                  ? 'bg-[#0077C8] text-white shadow'
                  : 'bg-[#111827] text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] border border-[#374151]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                  isActive ? 'bg-black/30 text-white' : 'bg-[#1F2937] text-[#9CA3AF]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome ou número de telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-8 py-2 bg-[#111827] border border-[#374151] rounded-xl text-xs text-white placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#0077C8]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 sm:w-auto w-full">
          <Filter className="w-4 h-4 text-[#9CA3AF] shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-[#111827] border border-[#374151] px-3 py-2 rounded-xl text-xs text-white focus:outline-none focus:border-[#0077C8] cursor-pointer w-full sm:w-auto"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="ATENDIDO">Atendido</option>
            <option value="CONFIRMADO">Confirmado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Main Content Card (Dual Mode: Cards no Mobile / Tabela no Desktop e Tablet) */}
      <div className="bg-[#111827] border border-[#374151] rounded-2xl overflow-hidden shadow-xl min-w-0">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#0077C8] animate-spin mx-auto" />
            <p className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
              Carregando inscrições...
            </p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="py-16 text-center space-y-3 px-4">
            <UserCheck className="w-12 h-12 text-[#374151] mx-auto" />
            <p className="text-sm font-medium text-white">Nenhuma inscrição encontrada.</p>
            <p className="text-xs text-[#9CA3AF] max-w-sm mx-auto">
              {searchTerm || activeTab !== 'TODOS' || statusFilter !== 'TODOS'
                ? 'Tente ajustar os filtros ou termo de busca.'
                : 'As inscrições enviadas na Landing Page aparecerão aqui.'}
            </p>
          </div>
        ) : (
          <>
            {/* 1. VISUALIZAÇÃO EM TABELA (Telas Grandes de Desktop >= 1280px) */}
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-[#1F2937]/80 text-[#9CA3AF] uppercase text-[10px] font-bold tracking-wider border-b border-[#374151]">
                  <tr>
                    <th className="px-5 py-3">Pessoa / Contato</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Detalhes / Valor</th>
                    <th className="px-4 py-3">Data & Hora Real</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#374151]/50">
                  {filteredLeads.map((item) => {
                    const isUpdating = updatingId === item.id;
                    const cleanPhone = item.phone.replace(/\D/g, '');
                    const waUrl = `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone}`;

                    return (
                      <tr key={item.id} className="hover:bg-[#1F2937]/40 transition-colors">
                        {/* Pessoa */}
                        <td className="px-5 py-4">
                          <div className="font-bold text-sm text-white">{item.name}</div>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 hover:underline mt-0.5"
                            title="Abrir conversa no WhatsApp"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{item.phone}</span>
                          </a>
                        </td>

                        {/* Tipo */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {item.type === 'pedido_oracao' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/80 border border-blue-800 text-blue-300 text-[11px] font-semibold">
                              <Heart className="w-3.5 h-3.5 text-blue-400" />
                              Pedido de Oração
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-[11px] font-semibold">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                              Doação Pix
                            </span>
                          )}
                        </td>

                        {/* Detalhes / Comprovante */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {item.type === 'doacao' ? (
                            <div className="space-y-1">
                              <div className="font-bold text-sm text-emerald-400 font-mono">
                                {item.amount
                                  ? item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                  : 'Valor não informado'}
                              </div>
                              {item.receiptProvided && item.receiptUrl ? (
                                <button
                                  onClick={() => setReceiptModalUrl(item.receiptUrl!)}
                                  className="inline-flex items-center gap-1 text-[11px] text-[#0077C8] hover:underline cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Ver Comprovante</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-[#9CA3AF] italic">
                                  Sem comprovante anexado
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-[#9CA3AF]">
                              Solicitação de Intercessão
                            </span>
                          )}
                        </td>

                        {/* Data & Hora Real */}
                        <td className="px-4 py-4 whitespace-nowrap font-mono text-xs text-white/90">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#9CA3AF]" />
                            <span>{formatDateTime(item.createdAt)}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {getStatusBadge(item.status)}
                        </td>

                        {/* Ações */}
                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Alternar Status */}
                            {item.status === 'PENDENTE' ? (
                              <button
                                onClick={() =>
                                  handleUpdateStatus(
                                    item.id,
                                    item.type === 'pedido_oracao' ? 'ATENDIDO' : 'CONFIRMADO'
                                  )
                                }
                                disabled={isUpdating}
                                className="px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-800 border border-emerald-700 text-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Marcar como Atendido / Confirmado"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Concluir</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateStatus(item.id, 'PENDENTE')}
                                disabled={isUpdating}
                                className="px-2 py-1.5 bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-[#9CA3AF] hover:text-white rounded-lg text-xs transition cursor-pointer"
                                title="Voltar para Pendente"
                              >
                                Pendente
                              </button>
                            )}

                            {/* Excluir */}
                            <button
                              onClick={() => setDeleteConfirmItem(item)}
                              className="p-1.5 rounded-lg bg-[#1F2937] hover:bg-rose-950 text-[#9CA3AF] hover:text-rose-400 transition cursor-pointer"
                              title="Excluir Inscrição"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 2. VISUALIZAÇÃO EM CARDS (Mobile e Tablet < 1280px) */}
            <div className="block xl:hidden divide-y divide-[#374151]/60">
              {filteredLeads.map((item) => {
                const isUpdating = updatingId === item.id;
                const cleanPhone = item.phone.replace(/\D/g, '');
                const waUrl = `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone}`;

                return (
                  <div key={item.id} className="p-3.5 sm:p-5 space-y-3 hover:bg-[#1F2937]/30 transition-colors">
                    {/* Top: Badges & Data */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.type === 'pedido_oracao' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-950/80 border border-blue-800 text-blue-300 text-[11px] font-semibold">
                            <Heart className="w-3 h-3 text-blue-400" />
                            <span>Oração</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-[11px] font-semibold">
                            <DollarSign className="w-3 h-3 text-emerald-400" />
                            <span>Doação Pix</span>
                          </span>
                        )}
                        {getStatusBadge(item.status)}
                      </div>
                      <span className="text-[11px] text-[#9CA3AF] font-mono shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#9CA3AF]" />
                        <span>{formatDateTime(item.createdAt)}</span>
                      </span>
                    </div>

                    {/* Person Details */}
                    <div>
                      <div className="font-bold text-sm text-white">{item.name}</div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{item.phone}</span>
                        </a>

                        {item.type === 'doacao' && (
                          <div className="font-bold text-xs text-emerald-400 font-mono">
                            {item.amount
                              ? item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : 'Valor n/ inf.'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Receipt link if available */}
                    {item.type === 'doacao' && item.receiptProvided && item.receiptUrl && (
                      <div className="pt-0.5">
                        <button
                          onClick={() => setReceiptModalUrl(item.receiptUrl!)}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-[#0077C8] hover:text-white border border-[#374151] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Comprovante Anexado</span>
                        </button>
                      </div>
                    )}

                    {/* Mobile Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-[#374151]/40">
                      {item.status === 'PENDENTE' ? (
                        <button
                          onClick={() =>
                            handleUpdateStatus(
                              item.id,
                              item.type === 'pedido_oracao' ? 'ATENDIDO' : 'CONFIRMADO'
                            )
                          }
                          disabled={isUpdating}
                          className="flex-1 py-2 px-3 bg-emerald-950/80 hover:bg-emerald-800 border border-emerald-700 text-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Concluir Inscrição</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'PENDENTE')}
                          disabled={isUpdating}
                          className="flex-1 py-2 px-3 bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-[#9CA3AF] hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                          Voltar para Pendente
                        </button>
                      )}

                      <button
                        onClick={() => setDeleteConfirmItem(item)}
                        className="p-2 rounded-xl bg-[#1F2937] hover:bg-rose-950/60 text-[#9CA3AF] hover:text-rose-400 transition cursor-pointer border border-rose-900/30 shrink-0"
                        title="Excluir Inscrição"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL: VISUALIZAR COMPROVANTE                            */}
      {/* ======================================================== */}
      {receiptModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-[#111827] border border-[#374151] rounded-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#374151]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Comprovante de Doação Pix</span>
              </h3>
              <button
                onClick={() => setReceiptModalUrl(null)}
                className="p-1.5 rounded-lg bg-[#1F2937] text-[#9CA3AF] hover:text-white transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded-xl bg-black/40 border border-[#374151] flex items-center justify-center min-h-[220px] sm:min-h-[300px]">
              {receiptModalUrl.endsWith('.pdf') ? (
                <iframe
                  src={receiptModalUrl}
                  title="Comprovante PDF"
                  className="w-full h-[350px] sm:h-[500px] rounded-lg"
                />
              ) : (
                <img
                  src={receiptModalUrl}
                  alt="Comprovante"
                  className="max-h-[350px] sm:max-h-[500px] w-auto object-contain rounded-lg"
                />
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 pt-2">
              <button
                onClick={() => setReceiptModalUrl(null)}
                className="px-4 py-2 bg-[#1F2937] hover:bg-[#374151] text-white rounded-xl text-xs font-bold transition cursor-pointer text-center"
              >
                Fechar
              </button>

              <a
                href={receiptModalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#0077C8] hover:underline flex items-center justify-center gap-1.5 py-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir em Nova Aba</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CONFIRMAR EXCLUSÃO                                */}
      {/* ======================================================== */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-[#111827] border border-rose-800/60 rounded-2xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-500" />
              <span>Confirmar Exclusão</span>
            </h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Deseja realmente excluir o registro de <strong className="text-white">"{deleteConfirmItem.name}"</strong>? Esta ação removerá a inscrição e eventuais comprovantes associados.
            </p>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2.5 bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow text-center"
              >
                Confirmar e Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
