import { useState } from 'react';
import {
  X,
  LogIn,
  UserPlus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  AtSign,
  Phone,
  User as UserIcon,
  Church,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { register, loginWithCredentials, loginWithPhone, checkUserExists } from '@/lib/auth';
import { markLoginPromptShown } from '@/lib/storage';
import type { UserProfile } from '@/lib/api';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // ─── LOGIN STATE ───
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginWithPhoneOnly, setLoginWithPhoneOnly] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginNotFound, setLoginNotFound] = useState(false);

  // ─── REGISTRO STATE ───
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [church, setChurch] = useState('');
  
  // Campos complementares opcionais
  const [showComplementary, setShowComplementary] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | ''>('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [ministry, setMinistry] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isBaptized, setIsBaptized] = useState(false);
  const [inDiscipleship, setInDiscipleship] = useState(false);

  const [isRegistering, setIsRegistering] = useState(false);
  const [existingUser, setExistingUser] = useState<UserProfile | null>(null);

  // Mensagens gerais
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!open) return null;

  const handleDismiss = () => {
    markLoginPromptShown();
    setError('');
    setLoginNotFound(false);
    setExistingUser(null);
    onClose();
  };

  // ─── SUBMIT LOGIN ────────────────────────────────────────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoginNotFound(false);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Informe seu e-mail, nome de usuário ou telefone.');
      return;
    }

    setIsLoggingIn(true);
    try {
      if (loginWithPhoneOnly) {
        const cleanPhone = cleanId.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
          setError('Informe um telefone válido com DDD (mínimo 10 dígitos).');
          setIsLoggingIn(false);
          return;
        }
        const result = await loginWithPhone(cleanPhone);
        if (result.success && result.user) {
          setSuccessMsg(`Bem-vindo de volta, ${result.user.name}!`);
          markLoginPromptShown();
          setTimeout(() => onSuccess(), 700);
        } else {
          setLoginNotFound(true);
          setError(result.error || 'Nenhum cadastro encontrado com este telefone.');
        }
      } else {
        const result = await loginWithCredentials(cleanId, loginPassword);
        if (result.success && result.user) {
          setSuccessMsg(`Bem-vindo de volta, ${result.user.name}!`);
          markLoginPromptShown();
          setTimeout(() => onSuccess(), 700);
        } else {
          setError(result.error || 'Credenciais inválidas. Verifique seu login e senha.');
        }
      }
    } catch {
      setError('Erro ao conectar ao servidor. Verifique sua conexão e tente novamente.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ─── SUBMIT CADASTRO ──────────────────────────────────────────────────────
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setExistingUser(null);

    if (!name.trim() || name.trim().length < 2) {
      setError('Informe seu nome completo (mínimo 2 letras).');
      return;
    }

    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setError('Escolha um nome de usuário com pelo menos 3 caracteres (letras ou números).');
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Informe um e-mail válido.');
      return;
    }

    const cleanPhone = registerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Informe um telefone válido com DDD (mínimo 10 dígitos).');
      return;
    }

    if (!registerPassword || registerPassword.length < 6) {
      setError('Crie uma senha com pelo menos 6 caracteres.');
      return;
    }

    if (registerPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setIsRegistering(true);
    try {
      const result = await register({
        name: name.trim(),
        username: cleanUsername,
        email: email.trim() || undefined,
        password: registerPassword,
        phone: cleanPhone,
        church: church.trim(),
        birthDate: birthDate || null,
        gender: gender || null,
        maritalStatus: maritalStatus || null,
        ministry: ministry.trim() || null,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
      });

      if (result.success && result.user) {
        setSuccessMsg(`Conta criada com sucesso! Bem-vindo(a), ${name.trim()}!`);
        markLoginPromptShown();
        setTimeout(() => onSuccess(), 800);
      } else {
        setError(result.error || 'Não foi possível concluir o cadastro.');
      }
    } catch {
      setError('Erro ao conectar ao servidor. Tente novamente.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4" onClick={handleDismiss}>
      <div
        className="w-full max-w-lg bg-[var(--color-surface)] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl border border-[var(--color-border)] max-h-[92vh] overflow-y-auto flex flex-col"
        style={{ paddingBottom: `calc(1.5rem + var(--safe-bottom))` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🕊️</span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] leading-tight">
                {tab === 'login' ? 'Acessar Conta' : 'Criar Nova Conta'}
              </h2>
              <p className="text-[11px] text-[var(--color-text-muted)]">Ministério Teleios</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-full hover:bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Abas Alternadoras */}
        <div className="flex rounded-xl bg-[var(--color-surface-alt)] p-1 mb-4 border border-[var(--color-border)] shrink-0">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError('');
              setExistingUser(null);
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              tab === 'login'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <LogIn size={15} />
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError('');
              setLoginNotFound(false);
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              tab === 'register'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <UserPlus size={15} />
            Cadastrar
          </button>
        </div>

        {/* Feedback de Sucesso */}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-emerald-400 text-xs sm:text-sm animate-fade-in shrink-0">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Feedback de Erro */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-red-400 text-xs sm:text-sm animate-fade-in shrink-0">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
              {loginNotFound && (
                <button
                  type="button"
                  onClick={() => {
                    setRegisterPhone(identifier);
                    setTab('register');
                    setError('');
                    setLoginNotFound(false);
                  }}
                  className="mt-2 text-xs font-semibold text-[var(--color-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus size={14} />
                  Criar conta agora com estes dados
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── ABA 1: LOGIN FLEXÍVEL (EMAIL, USERNAME OU TELEFONE + SENHA) ─── */}
        {tab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3 flex-1">
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Entre com seu e-mail, nome de usuário ou telefone cadastrado.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                <AtSign size={13} />
                <span>E-mail, Nome de Usuário ou Telefone</span>
              </label>
              <input
                type="text"
                placeholder="ex: @carlos, carlos@email.com ou (98) 98765-4321"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (error) setError('');
                  if (loginNotFound) setLoginNotFound(false);
                }}
                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            {!loginWithPhoneOnly && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <Lock size={13} />
                    <span>Senha</span>
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Sua senha de acesso"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white p-1 cursor-pointer"
                    title={showLoginPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Alternador de método de login */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setLoginWithPhoneOnly(!loginWithPhoneOnly)}
                className="text-xs text-[var(--color-primary-light)] hover:underline cursor-pointer"
              >
                {loginWithPhoneOnly ? 'Entrar com senha' : 'Entrar apenas com telefone'}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn || Boolean(successMsg)}
              className="w-full py-3 mt-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Entrar na Conta</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
            >
              Continuar navegando sem entrar
            </button>
          </form>
        )}

        {/* ─── ABA 2: CADASTRO COM EMAIL, SENHA, USERNAME E DADOS COMPLETOS ─── */}
        {tab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3 flex-1">
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Crie seu perfil completo para salvar seu progresso bíblico e interagir com a comunidade.
            </p>

            {/* Nome Completo */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                <UserIcon size={13} />
                <span>Nome Completo *</span>
              </label>
              <input
                type="text"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                autoComplete="name"
                required
              />
            </div>

            {/* Grid: Nome de Usuário e Telefone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <AtSign size={13} />
                  <span>Nome de Usuário *</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)] font-bold">@</span>
                  <input
                    type="text"
                    placeholder="usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/^@/, '').toLowerCase())}
                    className="w-full pl-7 pr-3 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Phone size={13} />
                  <span>Telefone / WhatsApp *</span>
                </label>
                <input
                  type="tel"
                  placeholder="(98) 98765-4321"
                  value={registerPhone}
                  onChange={(e) => setRegisterPhone(formatPhone(e.target.value))}
                  className="w-full px-3.5 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  autoComplete="tel"
                  required
                />
              </div>
            </div>

            {/* Grid: E-mail e Igreja */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Mail size={13} />
                  <span>E-mail</span>
                </label>
                <input
                  type="email"
                  placeholder="exemplo@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Church size={13} />
                  <span>Igreja / Congregação</span>
                </label>
                <input
                  type="text"
                  placeholder="Nome da igreja"
                  value={church}
                  onChange={(e) => setChurch(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            {/* Grid: Senha e Confirmação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Lock size={13} />
                  <span>Criar Senha * (mín. 6)</span>
                </label>
                <div className="relative">
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full pl-3.5 pr-9 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white p-1 cursor-pointer"
                  >
                    {showRegisterPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--color-text-muted)]">
                  Confirmar Senha *
                </label>
                <input
                  type={showRegisterPassword ? 'text' : 'password'}
                  placeholder="Repita sua senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            {/* Botão para Expandir Dados Complementares Opcionais */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowComplementary(!showComplementary)}
                className="w-full py-2 px-3 rounded-xl bg-[var(--color-surface-alt)] hover:bg-[var(--color-border)]/40 border border-[var(--color-border)] text-xs text-[var(--color-primary-light)] font-semibold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" />
                  <span>Completar cadastro com dados adicionais (Opcional)</span>
                </span>
                {showComplementary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {/* SEÇÃO OPCIONAL EXPANDIDA */}
            {showComplementary && (
              <div className="p-3.5 bg-[var(--color-surface-alt)]/60 border border-[var(--color-border)] rounded-xl space-y-3 animate-fade-in">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">Nascimento</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">Gênero</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                    >
                      <option value="">Não informar</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">Estado Civil</label>
                    <select
                      value={maritalStatus}
                      onChange={(e) => setMaritalStatus(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                    >
                      <option value="">Selecione...</option>
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">Ministério</label>
                    <input
                      type="text"
                      placeholder="Ex: Louvor, Intercessão"
                      value={ministry}
                      onChange={(e) => setMinistry(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">Cidade</label>
                    <input
                      type="text"
                      placeholder="Sua cidade"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">UF</label>
                    <input
                      type="text"
                      placeholder="UF"
                      maxLength={2}
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      className="w-full px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] text-center"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-[var(--color-text)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isBaptized}
                      onChange={(e) => setIsBaptized(e.target.checked)}
                      className="rounded border-[var(--color-border)] text-[var(--color-primary)]"
                    />
                    <span>Batizado nas águas</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-[var(--color-text)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inDiscipleship}
                      onChange={(e) => setInDiscipleship(e.target.checked)}
                      className="rounded border-[var(--color-border)] text-[var(--color-primary)]"
                    />
                    <span>Faz discipulado</span>
                  </label>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isRegistering || Boolean(successMsg)}
              className="w-full py-3.5 mt-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm"
            >
              {isRegistering ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Cadastrando...</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Criar Minha Conta</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
            >
              Pular por enquanto
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
