import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  MessageCircle,
  Calendar,
  Heart,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  X,
  Edit2,
  Save,
  BookOpen,
  GraduationCap,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { apiFetch } from '../../services/api.service.ts';

export interface AppUserDetail {
  id: string;
  name: string;
  phone: string;
  church?: string;
  city?: string;
  state?: string;
  photoUrl?: string | null;
  status: 'Ativo' | 'Inativo';
  role?: 'admin' | 'user' | string;
  isAdmin?: boolean;
  isBaptized?: boolean;
  timeAsBeliever?: string;
  inDiscipleship?: boolean;
  disciplerName?: string;
  notes?: string;
  currentDevocional?: string;
  currentEstudo?: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt?: string;
  prayersCount?: number;
  donationsCount?: number;
  donationsTotal?: number;
}

export const UsuariosView: React.FC = () => {
  const [users, setUsers] = useState<AppUserDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<AppUserDetail | null>(null);
  const [selectedUserData, setSelectedUserData] = useState<{
    prayers: any[];
    donations: any[];
  } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<'pessoal' | 'oracoes' | 'doacoes' | 'atividade'>('pessoal');

  // Form edit state
  const [editName, setEditName] = useState('');
  const [editChurch, setEditChurch] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editStatus, setEditStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editIsBaptized, setEditIsBaptized] = useState(false);
  const [editTimeAsBeliever, setEditTimeAsBeliever] = useState('');
  const [editInDiscipleship, setEditInDiscipleship] = useState(false);
  const [editDisciplerName, setEditDisciplerName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/app/users');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setUsers(json.data);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOpenUser = async (user: AppUserDetail) => {
    setSelectedUser(user);
    setEditName(user.name || '');
    setEditChurch(user.church || '');
    setEditCity(user.city || '');
    setEditState(user.state || '');
    setEditStatus(user.status || 'Ativo');
    setEditRole((user.role === 'admin' || user.isAdmin) ? 'admin' : 'user');
    setEditIsBaptized(Boolean(user.isBaptized));
    setEditTimeAsBeliever(user.timeAsBeliever || '');
    setEditInDiscipleship(Boolean(user.inDiscipleship));
    setEditDisciplerName(user.disciplerName || '');
    setEditNotes(user.notes || '');
    setActiveProfileTab('pessoal');

    setIsLoadingDetail(true);
    try {
      const res = await apiFetch(`/api/app/users/${user.id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedUserData({
          prayers: json.data.prayers || [],
          donations: json.data.donations || [],
        });
        if (json.data.user) {
          setSelectedUser((prev) => ({ ...prev, ...json.data.user }));
          if (json.data.user.role || json.data.user.isAdmin !== undefined) {
            setEditRole((json.data.user.role === 'admin' || json.data.user.isAdmin) ? 'admin' : 'user');
          }
        }
      }
    } catch {
      setSelectedUserData({ prayers: [], donations: [] });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsSaving(true);
    try {
      const res = await apiFetch(`/api/app/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          church: editChurch.trim(),
          city: editCity.trim(),
          state: editState.trim(),
          status: editStatus,
          role: editRole,
          isAdmin: editRole === 'admin',
          isBaptized: editIsBaptized,
          timeAsBeliever: editTimeAsBeliever.trim(),
          inDiscipleship: editInDiscipleship,
          disciplerName: editDisciplerName.trim(),
          notes: editNotes.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        showFeedback('success', 'Perfil do usuário atualizado com sucesso!');
        setSelectedUser((prev) => (prev ? { ...prev, ...json.data } : null));
        loadUsers();
      } else {
        showFeedback('error', json.error || 'Erro ao salvar perfil.');
      }
    } catch {
      showFeedback('error', 'Erro de conexão ao salvar perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.church || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q)
    );
  }, [users, searchTerm]);

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
            <Users className="w-6 h-6 text-blue-400" />
            <span>Usuários</span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Pessoas cadastradas na plataforma e acompanhamento ministerial
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={loadUsers}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-[#374151] bg-[#111827] text-gray-300 hover:text-white hover:bg-[#1F2937] transition-colors cursor-pointer shrink-0"
            title="Recarregar usuários"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Barra de Busca Simples */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar usuário por nome, igreja ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#111827] border border-[#374151] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Lista Limpa e Simples de Usuários */}
      {isLoading ? (
        <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span>Carregando usuários...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-16 text-center bg-[#111827] border border-[#374151] rounded-2xl p-8">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-300 font-semibold text-lg">Nenhum usuário encontrado</p>
          <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
            Assim que novos membros se cadastrarem no aplicativo Teleios, eles aparecerão nesta lista.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => handleOpenUser(user)}
              className="bg-[#111827] border border-[#374151] hover:border-blue-500/60 rounded-2xl p-5 text-left transition-all cursor-pointer flex items-center gap-4 group active:scale-[0.99] shadow-sm"
            >
              {/* Avatar */}
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="w-13 h-13 rounded-full object-cover border-2 border-blue-500/40 shrink-0"
                />
              ) : (
                <div className="w-13 h-13 rounded-full bg-gradient-to-br from-blue-900/60 to-indigo-900/60 border border-blue-500/30 flex items-center justify-center text-blue-300 font-bold text-lg shrink-0">
                  {(user.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}

              {/* Informações Básicas (Conforme Exemplo do Usuário) */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-white text-base truncate group-hover:text-blue-400 transition-colors">
                    {user.name}
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(user.role === 'admin' || user.isAdmin) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                        👑 Admin
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        user.status === 'Ativo'
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                          : 'bg-gray-800 text-gray-400 border-gray-700'
                      }`}
                    >
                      {user.status || 'Ativo'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {user.church || 'Igreja não informada'}
                </p>

                {/* Resumo de Atividade */}
                <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-2">
                  <span>🙏 {user.prayersCount ?? 0} orações</span>
                  <span>💙 {user.donationsCount ?? 0} doações</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal: PERFIL COMPLETO DO USUÁRIO */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#111827] border border-[#374151] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8 flex flex-col max-h-[90vh]">
            {/* Header do Perfil */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#374151] bg-[#161F30]">
              <div className="flex items-center gap-3">
                {selectedUser.photoUrl ? (
                  <img
                    src={selectedUser.photoUrl}
                    alt={selectedUser.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-blue-500 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-900/60 border border-blue-500/40 flex items-center justify-center text-blue-300 font-bold text-lg shrink-0">
                    {(selectedUser.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{selectedUser.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        selectedUser.status === 'Ativo'
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                          : 'bg-gray-800 text-gray-400 border-gray-700'
                      }`}
                    >
                      {selectedUser.status || 'Ativo'}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    {selectedUser.church || 'Igreja não informada'} • Cadastrado em{' '}
                    {new Date(selectedUser.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1F2937] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas de Navegação no Perfil */}
            <div className="flex border-b border-[#374151] px-6 bg-[#0A0F1A] gap-4">
              <button
                onClick={() => setActiveProfileTab('pessoal')}
                className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeProfileTab === 'pessoal'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Dados Pessoais & Discipulado
              </button>
              <button
                onClick={() => setActiveProfileTab('oracoes')}
                className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeProfileTab === 'oracoes'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>Orações</span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#1F2937] text-[10px]">
                  {selectedUserData?.prayers.length ?? selectedUser.prayersCount ?? 0}
                </span>
              </button>
              <button
                onClick={() => setActiveProfileTab('doacoes')}
                className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeProfileTab === 'doacoes'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>Doações</span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#1F2937] text-[10px]">
                  {selectedUserData?.donations.length ?? selectedUser.donationsCount ?? 0}
                </span>
              </button>
              <button
                onClick={() => setActiveProfileTab('atividade')}
                className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeProfileTab === 'atividade'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Atividade
              </button>
            </div>

            {/* Conteúdo das Abas do Perfil */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* ABA 1: DADOS PESSOAIS & CAMINHADA CRISTÃ */}
              {activeProfileTab === 'pessoal' && (
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  {/* Seção 1: Dados Pessoais */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Informações Pessoais
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">Nome Completo</label>
                        <input
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">Telefone / WhatsApp</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            disabled
                            value={selectedUser.phone}
                            className="w-full px-3 py-2 bg-[#111827] border border-[#374151] rounded-lg text-sm text-gray-400 cursor-not-allowed"
                          />
                          {selectedUser.phone && (
                            <a
                              href={`https://wa.me/${selectedUser.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/40 rounded-lg flex items-center justify-center shrink-0"
                              title="Conversar no WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">Igreja / Congregação</label>
                        <input
                          type="text"
                          value={editChurch}
                          onChange={(e) => setEditChurch(e.target.value)}
                          placeholder="Ex: Igreja Batista Central"
                          className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1">Cidade</label>
                          <input
                            type="text"
                            value={editCity}
                            onChange={(e) => setEditCity(e.target.value)}
                            placeholder="São Paulo"
                            className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1">Estado</label>
                          <input
                            type="text"
                            value={editState}
                            onChange={(e) => setEditState(e.target.value)}
                            placeholder="SP"
                            maxLength={2}
                            className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1">Status da Conta</label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as any)}
                            className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="Ativo">Ativo</option>
                            <option value="Inativo">Inativo</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1 font-semibold flex items-center justify-between">
                            <span>Função no App</span>
                            {editRole === 'admin' && (
                              <span className="text-[10px] text-amber-400 font-bold bg-amber-950/60 border border-amber-800 px-1.5 py-0.5 rounded">
                                Upload Liberado
                              </span>
                            )}
                          </label>
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as any)}
                            className={`w-full px-3 py-2 border rounded-lg text-sm text-white focus:outline-none font-medium ${
                              editRole === 'admin'
                                ? 'bg-amber-950/30 border-amber-500/60 text-amber-200 focus:border-amber-400'
                                : 'bg-[#1F2937] border-[#374151] focus:border-blue-500'
                            }`}
                          >
                            <option value="user">Membro Comum</option>
                            <option value="admin">👑 Administrador (Upload no App)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seção 2: Caminhada Cristã & Discipulado */}
                  <div className="space-y-3 pt-3 border-t border-[#374151]">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Caminhada Cristã & Discipulado
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">É Batizado?</label>
                        <select
                          value={editIsBaptized ? 'sim' : 'nao'}
                          onChange={(e) => setEditIsBaptized(e.target.value === 'sim')}
                          className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="nao">Não</option>
                          <option value="sim">Sim</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">Tempo de Cristão/Fé</label>
                        <input
                          type="text"
                          value={editTimeAsBeliever}
                          onChange={(e) => setEditTimeAsBeliever(e.target.value)}
                          placeholder="Ex: 3 anos, Desde a infância..."
                          className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">Faz Discipulado?</label>
                        <select
                          value={editInDiscipleship ? 'sim' : 'nao'}
                          onChange={(e) => setEditInDiscipleship(e.target.value === 'sim')}
                          className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="nao">Não</option>
                          <option value="sim">Sim</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">Nome do Discipulador</label>
                        <input
                          type="text"
                          value={editDisciplerName}
                          onChange={(e) => setEditDisciplerName(e.target.value)}
                          placeholder="Quem acompanha no discipulado"
                          disabled={!editInDiscipleship}
                          className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção 3: Observações Administrativas */}
                  <div className="space-y-3 pt-3 border-t border-[#374151]">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Observações Administrativas (Notas Internas)
                    </h4>
                    <textarea
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Anotações internas da equipe pastoral/administrativa sobre este membro..."
                      className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Botão de Salvar Alterações */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl cursor-pointer shadow-md transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSaving ? 'Salvando...' : 'Salvar Informações'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* ABA 2: PEDIDOS DE ORAÇÃO */}
              {activeProfileTab === 'oracoes' && (
                <div className="space-y-4">
                  {isLoadingDetail ? (
                    <div className="py-8 text-center text-gray-400">Carregando pedidos de oração...</div>
                  ) : !selectedUserData?.prayers || selectedUserData.prayers.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                      <Heart className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                      <p className="font-medium text-gray-300">Nenhum pedido de oração registrado</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Os pedidos enviados pelo aplicativo aparecerão aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedUserData.prayers.map((prayer) => (
                        <div
                          key={prayer.id}
                          className="p-4 bg-[#1F2937] border border-[#374151] rounded-xl space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-white text-sm">
                              {prayer.title || 'Pedido de Oração'}
                            </h4>
                            <span className="text-[11px] text-gray-400">
                              {new Date(prayer.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {prayer.content}
                          </p>
                          <div className="pt-1 flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-800/40">
                              {prayer.status || 'PENDENTE'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: DOAÇÕES */}
              {activeProfileTab === 'doacoes' && (
                <div className="space-y-4">
                  {isLoadingDetail ? (
                    <div className="py-8 text-center text-gray-400">Carregando doações...</div>
                  ) : !selectedUserData?.donations || selectedUserData.donations.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                      <DollarSign className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                      <p className="font-medium text-gray-300">Nenhuma doação registrada</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        As doações geradas pelo usuário via Pix aparecerão aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedUserData.donations.map((d) => (
                        <div
                          key={d.id}
                          className="p-4 bg-[#1F2937] border border-[#374151] rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <span className="text-base font-bold text-emerald-400">
                              R$ {(Number(d.amount) || 0).toFixed(2)}
                            </span>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Data: {new Date(d.createdAt).toLocaleDateString('pt-BR')}
                              {d.txid ? ` • TXID: ${d.txid}` : ''}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                              d.status === 'CONFIRMADO'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                : 'bg-amber-950/80 text-amber-300 border-amber-800'
                            }`}
                          >
                            {d.status || 'PENDENTE'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 4: ATIVIDADE NA PLATAFORMA */}
              {activeProfileTab === 'atividade' && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#1F2937] border border-[#374151] rounded-xl space-y-3">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-xs text-gray-400">Última Atividade Registrada</p>
                        <p className="text-sm font-semibold text-white">
                          {selectedUser.lastActivityAt
                            ? new Date(selectedUser.lastActivityAt).toLocaleString('pt-BR')
                            : 'Nenhum registro ainda'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 bg-[#1F2937] border border-[#374151] rounded-xl space-y-1">
                      <div className="flex items-center gap-2 text-indigo-400 mb-1">
                        <BookOpen className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Devocionais</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Acompanhando:{' '}
                        <span className="text-gray-200 font-medium">
                          {selectedUser.currentDevocional || 'Nenhum ativo'}
                        </span>
                      </p>
                    </div>

                    <div className="p-4 bg-[#1F2937] border border-[#374151] rounded-xl space-y-1">
                      <div className="flex items-center gap-2 text-blue-400 mb-1">
                        <GraduationCap className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Estudos</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Acompanhando:{' '}
                        <span className="text-gray-200 font-medium">
                          {selectedUser.currentEstudo || 'Nenhum ativo'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
