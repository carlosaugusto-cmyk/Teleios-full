import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  QrCode,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Save,
  Check,
  Calendar,
} from 'lucide-react';
import { apiFetch } from '../../services/api.service.ts';

interface DonationItem {
  id: string;
  name: string;
  phone: string;
  amount: number;
  txid?: string;
  status: 'PENDENTE' | 'CONFIRMADO' | 'CANCELADO';
  createdAt: string;
}

interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  notes?: string;
  createdAt: string;
}

interface FinancialSummary {
  entradasConfirmadas: number;
  entradasPendentes: number;
  saidasTotal: number;
  saldo: number;
  donations: DonationItem[];
  expenses: ExpenseItem[];
}

export const ControleFinanceiroView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'entradas' | 'saidas' | 'pix'>('entradas');
  const [summary, setSummary] = useState<FinancialSummary>({
    entradasConfirmadas: 0,
    entradasPendentes: 0,
    saidasTotal: 0,
    saldo: 0,
    donations: [],
    expenses: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal de Nova Saída
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expenseCategory, setExpenseCategory] = useState('Manutenção');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  // Configuração Pix
  const [pixKey, setPixKey] = useState('');
  const [pixType, setPixType] = useState<'cpf' | 'cnpj' | 'email' | 'phone' | 'random'>('email');
  const [pixName, setPixName] = useState('MINISTERIO TELEIOS');
  const [pixCity, setPixCity] = useState('SAO PAULO');
  const [pixDescription, setPixDescription] = useState('Doacao Ministerio Teleios');
  const [isSavingPix, setIsSavingPix] = useState(false);

  const loadFinancialData = async () => {
    setIsLoading(true);
    try {
      const [sumRes, configRes] = await Promise.all([
        apiFetch('/api/financial/summary'),
        apiFetch('/api/config/admin'),
      ]);

      const sumJson = await sumRes.json();
      if (sumJson.success && sumJson.data) {
        setSummary(sumJson.data);
      }

      const configJson = await configRes.json();
      if (configJson.success && configJson.data?.pix) {
        const p = configJson.data.pix;
        setPixKey(p.key || '');
        setPixType(p.keyType || 'email');
        setPixName(p.receiverName || 'MINISTERIO TELEIOS');
        setPixCity(p.receiverCity || 'SAO PAULO');
        setPixDescription(p.description || 'Doacao Ministerio Teleios');
      }
    } catch {
      showFeedback('error', 'Erro ao carregar dados financeiros.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleUpdateDonationStatus = async (id: string, newStatus: 'CONFIRMADO' | 'PENDENTE' | 'CANCELADO') => {
    try {
      const res = await apiFetch(`/api/financial/donations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        showFeedback('success', `Status da doação atualizado para ${newStatus}.`);
        loadFinancialData();
      } else {
        showFeedback('error', json.error || 'Erro ao atualizar doação.');
      }
    } catch {
      showFeedback('error', 'Erro de conexão.');
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(expenseAmount.replace(',', '.'));
    if (!expenseDesc.trim() || isNaN(val) || val <= 0) {
      showFeedback('error', 'Preencha uma descrição e um valor válido.');
      return;
    }

    setIsSavingExpense(true);
    try {
      const res = await apiFetch('/api/financial/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: expenseDesc.trim(),
          amount: val,
          date: expenseDate,
          category: expenseCategory,
          notes: expenseNotes.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        showFeedback('success', 'Saída registrada com sucesso!');
        setIsExpenseModalOpen(false);
        setExpenseDesc('');
        setExpenseAmount('');
        setExpenseNotes('');
        loadFinancialData();
      } else {
        showFeedback('error', json.error || 'Erro ao registrar saída.');
      }
    } catch {
      showFeedback('error', 'Erro de conexão.');
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta saída financeira?')) return;
    try {
      const res = await apiFetch(`/api/financial/expenses/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showFeedback('success', 'Saída excluída com sucesso.');
        loadFinancialData();
      } else {
        showFeedback('error', json.error || 'Erro ao excluir saída.');
      }
    } catch {
      showFeedback('error', 'Erro de conexão.');
    }
  };

  const handleSavePix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pixKey.trim()) {
      showFeedback('error', 'A chave Pix é obrigatória.');
      return;
    }

    setIsSavingPix(true);
    try {
      const res = await apiFetch('/api/config/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pix: {
            key: pixKey.trim(),
            keyType: pixType,
            receiverName: pixName.trim(),
            receiverCity: pixCity.trim(),
            description: pixDescription.trim(),
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        showFeedback('success', 'Configurações de Pix salvas com sucesso! O aplicativo já utilizará esta chave.');
      } else {
        showFeedback('error', json.error || 'Erro ao salvar Pix.');
      }
    } catch {
      showFeedback('error', 'Erro de conexão.');
    } finally {
      setIsSavingPix(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200'
              : 'bg-red-950/80 border-red-600 text-red-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#374151]">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            <span>Controle Financeiro</span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Gestão simplificada de doações recebidas, despesas e configuração de chave Pix
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={loadFinancialData}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-[#374151] bg-[#111827] text-gray-300 hover:text-white hover:bg-[#1F2937] transition-colors cursor-pointer shrink-0"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600/90 hover:bg-red-600 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Saída</span>
          </button>
        </div>
      </div>

      {/* ─── RESUMO FINANCEIRO (ITEM 11 DO PROMPT) ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Entradas */}
        <div className="bg-[#111827] border border-[#374151] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Entradas (Confirmadas)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400">
            R$ {summary.entradasConfirmadas.toFixed(2)}
          </div>
          <p className="text-[11px] text-gray-500">
            {summary.donations.length} doações registradas (R$ {summary.entradasPendentes.toFixed(2)} pendentes)
          </p>
        </div>

        {/* Saídas */}
        <div className="bg-[#111827] border border-[#374151] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Saídas
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-950/60 text-red-400 border border-red-800/40 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-400">
            R$ {summary.saidasTotal.toFixed(2)}
          </div>
          <p className="text-[11px] text-gray-500">
            {summary.expenses.length} despesas manuais cadastradas
          </p>
        </div>

        {/* Saldo */}
        <div className="bg-[#111827] border border-[#374151] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Saldo
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/60 text-blue-400 border border-blue-800/40 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-black ${
              summary.saldo >= 0 ? 'text-blue-400' : 'text-amber-400'
            }`}
          >
            R$ {summary.saldo.toFixed(2)}
          </div>
          <p className="text-[11px] text-gray-500">
            Saldo = Entradas confirmadas − Saídas
          </p>
        </div>
      </div>

      {/* Navegação entre Abas */}
      <div className="flex border-b border-[#374151] gap-6">
        <button
          onClick={() => setActiveTab('entradas')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'entradas'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Entradas / Doações</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-[#1F2937] text-gray-300">
            {summary.donations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('saidas')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'saidas'
              ? 'border-red-500 text-red-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Saídas / Despesas</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-[#1F2937] text-gray-300">
            {summary.expenses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('pix')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'pix'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Configuração do Pix</span>
        </button>
      </div>

      {/* ─── ABA 1: ENTRADAS (DOAÇÕES) ───────────────────────────────────────── */}
      {activeTab === 'entradas' && (
        <div className="space-y-4">
          {summary.donations.length === 0 ? (
            <div className="py-16 text-center bg-[#111827] border border-[#374151] rounded-2xl p-8">
              <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-300 font-semibold text-lg">Nenhuma doação registrada ainda</p>
              <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
                As doações geradas no aplicativo Teleios aparecerão aqui com data, valor e status para conferência.
              </p>
            </div>
          ) : (
            <div className="bg-[#111827] border border-[#374151] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#161F30] text-gray-400 text-xs uppercase border-b border-[#374151]">
                    <tr>
                      <th className="px-5 py-3.5">Doador</th>
                      <th className="px-5 py-3.5">Contato</th>
                      <th className="px-5 py-3.5">Valor</th>
                      <th className="px-5 py-3.5">Data</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2937]">
                    {summary.donations.map((d) => (
                      <tr key={d.id} className="hover:bg-[#161F30]/50 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-white">
                          {d.name || 'Anônimo'}
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">
                          {d.phone || '—'}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-emerald-400 text-base">
                          R$ {(Number(d.amount) || 0).toFixed(2)}
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">
                          {new Date(d.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                              d.status === 'CONFIRMADO'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                : d.status === 'CANCELADO'
                                ? 'bg-red-950/80 text-red-300 border-red-800'
                                : 'bg-amber-950/80 text-amber-300 border-amber-800'
                            }`}
                          >
                            {d.status || 'PENDENTE'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {d.status !== 'CONFIRMADO' ? (
                            <button
                              onClick={() => handleUpdateDonationStatus(d.id, 'CONFIRMADO')}
                              className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-600/40 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Confirmar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateDonationStatus(d.id, 'PENDENTE')}
                              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-xs transition-colors cursor-pointer"
                            >
                              Desfazer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── ABA 2: SAÍDAS (DESPESAS) ────────────────────────────────────────── */}
      {activeTab === 'saidas' && (
        <div className="space-y-4">
          {summary.expenses.length === 0 ? (
            <div className="py-16 text-center bg-[#111827] border border-[#374151] rounded-2xl p-8">
              <TrendingDown className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-300 font-semibold text-lg">Nenhuma saída registrada</p>
              <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
                Clique no botão "Registrar Saída" para adicionar despesas e manter o saldo atualizado.
              </p>
            </div>
          ) : (
            <div className="bg-[#111827] border border-[#374151] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#161F30] text-gray-400 text-xs uppercase border-b border-[#374151]">
                    <tr>
                      <th className="px-5 py-3.5">Descrição</th>
                      <th className="px-5 py-3.5">Categoria</th>
                      <th className="px-5 py-3.5">Valor</th>
                      <th className="px-5 py-3.5">Data</th>
                      <th className="px-5 py-3.5">Observação</th>
                      <th className="px-5 py-3.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2937]">
                    {summary.expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-[#161F30]/50 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-white">
                          {e.description}
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">
                          <span className="px-2 py-0.5 rounded bg-[#1F2937] text-gray-300 border border-[#374151]">
                            {e.category}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-red-400 text-base">
                          - R$ {(Number(e.amount) || 0).toFixed(2)}
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">
                          {new Date(e.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs max-w-xs truncate">
                          {e.notes || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteExpense(e.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-[#1F2937] transition-colors cursor-pointer"
                            title="Excluir saída"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── ABA 3: CONFIGURAÇÃO DO PIX ──────────────────────────────────────── */}
      {activeTab === 'pix' && (
        <div className="bg-[#111827] border border-[#374151] rounded-2xl p-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/40 text-blue-400 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Configuração Oficial do Pix</h3>
              <p className="text-xs text-gray-400">
                Esta chave será utilizada automaticamente na geração do BR Code e Copia e Cola no app
              </p>
            </div>
          </div>

          <form onSubmit={handleSavePix} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Tipo de Chave
                </label>
                <select
                  value={pixType}
                  onChange={(e) => setPixType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="email">E-mail</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave Aleatória (EVP)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Chave Pix *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: pix@ministerioteleios.com.br"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="w-full px-4 py-2 bg-[#1F2937] border border-[#374151] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Nome do Beneficiário (até 25 chars)
                </label>
                <input
                  type="text"
                  maxLength={25}
                  required
                  placeholder="Ex: MINISTERIO TELEIOS"
                  value={pixName}
                  onChange={(e) => setPixName(e.target.value)}
                  className="w-full px-4 py-2 bg-[#1F2937] border border-[#374151] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Cidade do Beneficiário (até 15 chars)
                </label>
                <input
                  type="text"
                  maxLength={15}
                  required
                  placeholder="Ex: SAO PAULO"
                  value={pixCity}
                  onChange={(e) => setPixCity(e.target.value)}
                  className="w-full px-4 py-2 bg-[#1F2937] border border-[#374151] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Descrição da Transação (opcional)
              </label>
              <input
                type="text"
                maxLength={25}
                placeholder="Ex: Doacao Ministerio Teleios"
                value={pixDescription}
                onChange={(e) => setPixDescription(e.target.value)}
                className="w-full px-4 py-2 bg-[#1F2937] border border-[#374151] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-[#374151]">
              <button
                type="submit"
                disabled={isSavingPix}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl cursor-pointer shadow-md transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingPix ? 'Salvando...' : 'Salvar Configuração Pix'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: REGISTRAR SAÍDA MANUAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111827] border border-[#374151] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#374151] pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-400" />
                <span>Registrar Saída Financeira</span>
              </h3>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1F2937]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                  Descrição da Despesa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Manutenção do Servidor, Material de Estudo..."
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0,00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                    Data *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                  Categoria
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Infraestrutura">Infraestrutura & Tecnologia</option>
                  <option value="Material">Material & Publicações</option>
                  <option value="Ação Social">Ação Social & Cuidado</option>
                  <option value="Eventos">Eventos & Ministrações</option>
                  <option value="Administrativo">Administrativo</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                  Observações (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalhes adicionais..."
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#374151]">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#374151] text-sm text-gray-300 hover:bg-[#1F2937]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingExpense}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors"
                >
                  {isSavingExpense ? 'Salvando...' : 'Salvar Saída'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
