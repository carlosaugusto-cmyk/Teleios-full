import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  X,
  Check,
  Save,
  Loader2,
  UserCheck,
  UserX,
  Clock,
  Key,
} from 'lucide-react';
import { User, UserRole, PermissionModule, CreateUserInput, UpdateUserInput } from '../../../types/index.ts';
import { validateUsername, validatePassword } from '../../../services/security.service.ts';
import { dbStore } from '../../../data/mockStore.ts';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}

const ALL_PERMISSIONS: { key: PermissionModule; label: string; desc: string }[] = [
  { key: 'ingest', label: 'Ingestão & Studio', desc: 'Upload de arquivos para o Google Drive' },
  { key: 'estudos', label: 'Estudos & Gemini AI', desc: 'Ver, reprocessar e disparar estudos' },
  { key: 'galeria', label: 'Galeria de Mídias', desc: 'Gerenciar fotos e acervo fotográfico' },
  { key: 'videos', label: 'Vídeos & YouTube', desc: 'Gerenciar vídeos e publicação no YouTube' },
  { key: 'projetos', label: 'Projetos & Apoio', desc: 'Acessar documentos de projetos sociais' },
  { key: 'queues', label: 'Filas & Agendador', desc: 'Visualizar filas BullMQ e acionar Cron' },
  { key: 'config', label: 'Configurações & Segurança', desc: 'Gerenciar conexões de API e usuários' },
  { key: 'code', label: 'Código-Fonte', desc: 'Inspecionar estrutura do sistema' },
];

const ROLE_LABELS: Record<UserRole, { label: string; color: string }> = {
  superadmin: { label: 'Superadmin', color: 'bg-brand-red/20 text-brand-red border border-brand-red/30' },
  admin: { label: 'Admin', color: 'bg-brand-navy text-text-inverse' },
  operador: { label: 'Operador', color: 'bg-brand-blue/20 text-brand-blue border border-brand-blue/30' },
};

interface FormState {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  permissions: PermissionModule[];
}

const defaultForm: FormState = {
  username: '',
  displayName: '',
  password: '',
  role: 'operador',
  permissions: [],
};

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'edit'>('list');
  const [users, setUsers] = useState<Omit<User, 'passwordHash'>[]>([]);
  const [editingUser, setEditingUser] = useState<Omit<User, 'passwordHash'> | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadUsers = () => {
    setUsers(dbStore.listUsers());
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setActiveTab('list');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const togglePermission = (perm: PermissionModule) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const handleOpenCreate = () => {
    setForm(defaultForm);
    setError(null);
    setActiveTab('create');
  };

  const handleOpenEdit = (user: Omit<User, 'passwordHash'>) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      displayName: user.displayName,
      password: '',
      role: user.role,
      permissions: user.permissions.filter((p): p is PermissionModule => p !== '*'),
    });
    setError(null);
    setActiveTab('edit');
  };

  const validateForm = (requirePassword: boolean): string | null => {
    const uv = validateUsername(form.username);
    if (!uv.valid) return uv.error!;
    if (!form.displayName.trim()) return 'Nome de exibição é obrigatório.';
    if (requirePassword) {
      const pv = validatePassword(form.password);
      if (!pv.valid) return pv.error!;
    } else if (form.password && !validatePassword(form.password).valid) {
      return validatePassword(form.password).error!;
    }
    return null;
  };

  const handleCreate = async () => {
    const validationError = validateForm(true);
    if (validationError) { setError(validationError); return; }

    setIsLoading(true);
    setError(null);
    try {
      const input: CreateUserInput = {
        username: form.username,
        displayName: form.displayName,
        password: form.password,
        role: form.role,
        permissions: form.permissions,
      };
      await dbStore.createUser(input);
      loadUsers();
      showSuccess(`Usuário "${form.displayName}" criado com sucesso!`);
      setActiveTab('list');
    } catch (e: any) {
      setError(e.message || 'Erro ao criar usuário.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    const validationError = validateForm(false);
    if (validationError) { setError(validationError); return; }

    setIsLoading(true);
    setError(null);
    try {
      const input: UpdateUserInput = {
        displayName: form.displayName,
        role: form.role,
        permissions: form.permissions,
        ...(form.password ? { newPassword: form.password } : {}),
      };
      await dbStore.updateUser(editingUser.id, input);
      loadUsers();
      showSuccess(`Usuário "${form.displayName}" atualizado!`);
      setActiveTab('list');
    } catch (e: any) {
      setError(e.message || 'Erro ao atualizar usuário.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (user: Omit<User, 'passwordHash'>) => {
    if (user.id === 'user-superadmin-001') return;
    try {
      await dbStore.updateUser(user.id, { active: !user.active });
      loadUsers();
      showSuccess(`Usuário ${user.active ? 'desativado' : 'ativado'} com sucesso.`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = (user: Omit<User, 'passwordHash'>) => {
    if (user.id === 'user-superadmin-001') return;
    if (!confirm(`Confirmar exclusão permanente de "${user.displayName}"?`)) return;
    try {
      dbStore.deleteUser(user.id);
      loadUsers();
      showSuccess(`Usuário "${user.displayName}" removido.`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const isSuperadmin = (user: Omit<User, 'passwordHash'>) => user.id === 'user-superadmin-001';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-secondary border border-border-default rounded-2xl shadow-xl w-full max-w-3xl border border-border-default overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default bg-tertiary">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-brand-navy rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-brand-gold" />
                </div>
                <div>
                  <h2 className="font-serif font-bold text-lg text-text-primary">Gestão de Usuários & Permissões</h2>
                  <p className="text-xs text-text-muted uppercase tracking-wider">Controle de Acesso (RBAC)</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-brand-navy/20 transition-colors cursor-pointer min-h-[44px] flex items-center justify-center">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-6 pt-4 pb-0">
              {(['list', 'create'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setError(null); }}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg border-b-2 transition-colors cursor-pointer ${
                    activeTab === tab
                      ? 'border-brand-blue text-brand-blue bg-tertiary'
                      : 'border-transparent text-text-muted hover:text-text-primary'
                  }`}
                >
                  {tab === 'list' ? `Usuários (${users.length})` : '+ Novo Usuário'}
                </button>
              ))}
              {activeTab === 'edit' && (
                <span className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg border-b-2 border-brand-blue text-brand-blue">
                  Editar: {editingUser?.displayName}
                </span>
              )}
            </div>

            {/* Feedback */}
            <div className="px-6 pt-2">
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-red/10 border border-brand-red/30 rounded-lg text-brand-red text-xs font-medium mb-2">
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" /> {error}
                  </motion.div>
                )}
                {successMsg && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-green/10 border border-brand-green/30 rounded-lg text-brand-green text-xs font-medium mb-2">
                    <Check className="w-3.5 h-3.5 flex-shrink-0" /> {successMsg}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-3">

              {/* ======================== LISTA ======================== */}
              {activeTab === 'list' && (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div key={user.id} className={`bg-secondary border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      !user.active ? 'opacity-60 border-border-subtle' : 'border-border-default'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                          user.active ? 'bg-brand-navy text-text-inverse' : 'bg-tertiary text-text-muted'
                        }`}>
                          {user.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-text-primary">{user.displayName}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${ROLE_LABELS[user.role].color}`}>
                              {ROLE_LABELS[user.role].label}
                            </span>
                            {!user.active && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-tertiary text-text-muted">
                                Inativo
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted font-mono">@{user.username}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.permissions.includes('*') ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-brand-gold/20 text-brand-gold font-bold border border-brand-gold/30">ACESSO TOTAL</span>
                            ) : (
                              user.permissions.map((p) => (
                                <span key={p} className="text-xs px-2 py-0.5 rounded bg-brand-navy/20 text-text-primary font-mono border border-border-default">{p}</span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {user.lastLoginAt && (
                          <span className="hidden lg:flex items-center gap-1 text-xs text-text-muted font-mono">
                            <Clock className="w-3.5 h-3.5" /> {new Date(user.lastLoginAt).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        {!isSuperadmin(user) && user.id !== currentUserId && (
                          <>
                            <button
                              onClick={() => handleToggleActive(user)}
                              title={user.active ? 'Desativar usuário' : 'Ativar usuário'}
                              className="p-2 rounded-lg border border-border-default text-text-muted hover:text-brand-red hover:bg-brand-red/5 hover:border-brand-red/20 transition-colors cursor-pointer min-h-[44px] flex items-center justify-center"
                            >
                              {user.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleOpenEdit(user)}
                              title="Editar usuário"
                              className="p-2 rounded-lg border border-border-default text-text-muted hover:text-brand-blue hover:bg-brand-blue/5 hover:border-brand-blue/20 transition-colors cursor-pointer min-h-[44px] flex items-center justify-center"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(user)}
                              title="Excluir usuário"
                              className="p-2 rounded-lg border border-border-default text-brand-red hover:bg-brand-red/5 hover:border-brand-red/20 transition-colors cursor-pointer min-h-[44px] flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {isSuperadmin(user) && (
                          <span className="text-xs text-brand-gold font-bold font-mono flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Protegido
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleOpenCreate}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-border-default text-text-muted hover:border-brand-blue/50 hover:text-brand-blue flex items-center justify-center gap-2 text-sm font-bold transition-colors cursor-pointer min-h-[48px]"
                  >
                    <Plus className="w-4.5 h-4.5" />
                    Criar Novo Usuário
                  </button>
                </div>
              )}

              {/* ======================== CRIAR / EDITAR ======================== */}
              {(activeTab === 'create' || activeTab === 'edit') && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Username */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Usuário *</label>
                      <input
                        type="text"
                        value={form.username}
                        onChange={(e) => setForm((p) => ({ ...p, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                        placeholder="ex: joao.silva"
                        disabled={activeTab === 'edit'}
                        className="w-full px-4 py-3 bg-tertiary border border-border-default rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
                      />
                    </div>

                    {/* Display Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Nome de Exibição *</label>
                      <input
                        type="text"
                        value={form.displayName}
                        onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                        placeholder="ex: João Silva"
                        className="w-full px-4 py-3 bg-tertiary border border-border-default rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-colors min-h-[48px]"
                      />
                    </div>

                    {/* Papel */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Papel (Role) *</label>
                      <select
                        value={form.role}
                        onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                        className="w-full px-4 py-3 bg-tertiary border border-border-default rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-colors cursor-pointer min-h-[48px]"
                      >
                        <option value="operador">Operador</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    {/* Senha */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                        {activeTab === 'create' ? 'Senha *' : 'Nova Senha (opcional)'}
                      </label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={form.password}
                          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                          placeholder={activeTab === 'create' ? 'Mínimo 6 caracteres' : 'Deixe vazio para não alterar'}
                          className="w-full pl-9 pr-12 py-3 bg-tertiary border border-border-default rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-colors min-h-[48px]"
                        />
                        <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-text-muted hover:text-text-primary transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center">
                          {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Permissões */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Módulos com Acesso Permitido
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ALL_PERMISSIONS.map((perm) => {
                        const isChecked = form.permissions.includes(perm.key);
                        return (
                          <button
                            key={perm.key}
                            type="button"
                            onClick={() => togglePermission(perm.key)}
                            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors cursor-pointer min-h-[80px] ${
                              isChecked
                                ? 'border-brand-blue bg-brand-blue/5'
                                : 'border-border-default bg-tertiary hover:border-brand-blue/30'
                            }`}
                          >
                            <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isChecked ? 'bg-brand-blue border-brand-blue' : 'border-border-default'
                            }`}>
                              {isChecked && <Check className="w-3 h-3 text-text-inverse" />}
                            </div>
                            <div>
                              <span className={`text-sm font-bold block ${isChecked ? 'text-brand-blue' : 'text-text-primary'}`}>
                                {perm.label}
                              </span>
                              <span className="text-xs text-text-muted">{perm.desc}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-between pt-2 border-t border-border-default">
                    <button
                      type="button"
                      onClick={() => { setActiveTab('list'); setError(null); }}
                      className="px-5 py-2.5 border border-border-default text-text-secondary text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-tertiary transition-colors cursor-pointer min-h-[44px]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={activeTab === 'create' ? handleCreate : handleUpdate}
                      disabled={isLoading}
                      className="px-6 py-3 bg-brand-navy hover:bg-brand-navy/90 disabled:opacity-50 text-text-inverse text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-2 transition-colors cursor-pointer min-h-[48px]"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {activeTab === 'create' ? 'Criar Usuário' : 'Salvar Alterações'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};