import { useState } from 'react';
import { X, LogIn, UserPlus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { register, loginWithPhone, checkUserExists } from '@/lib/auth';
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
  
  // Login
  const [loginPhone, setLoginPhone] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginNotFound, setLoginNotFound] = useState(false);

  // Registro
  const [name, setName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [church, setChurch] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Conflito / Usuário existente encontrado durante tentativa de cadastro
  const [existingUser, setExistingUser] = useState<UserProfile | null>(null);

  // Mensagens gerais de feedback
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

  // ─── LOGIN COM TELEFONE ──────────────────────────────────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoginNotFound(false);

    const clean = loginPhone.replace(/\D/g, '');
    if (clean.length < 10) {
      setError('Informe um telefone válido com DDD (mínimo 10 dígitos).');
      return;
    }

    setIsLoggingIn(true);
    try {
      const result = await loginWithPhone(clean);
      if (result.success && result.user) {
        setSuccessMsg(`Bem-vindo de volta, ${result.user.name}!`);
        markLoginPromptShown();
        setTimeout(() => {
          onSuccess();
        }, 800);
      } else {
        setLoginNotFound(true);
        setError('Nenhum cadastro encontrado com este telefone.');
      }
    } catch {
      setError('Erro ao conectar ao servidor. Verifique sua conexão e tente novamente.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ─── CADASTRO DE NOVO USUÁRIO ─────────────────────────────────────────────
  const handleRegisterSubmit = async (e: React.FormEvent, forceUpdate = false) => {
    e.preventDefault();
    setError('');
    setExistingUser(null);

    if (!name.trim() || name.trim().length < 2) {
      setError('Informe seu nome completo (mínimo 2 letras).');
      return;
    }

    const clean = registerPhone.replace(/\D/g, '');
    if (clean.length < 10) {
      setError('Informe um telefone válido com DDD (mínimo 10 dígitos).');
      return;
    }

    setIsRegistering(true);
    try {
      // Se não for atualização forçada, verifica se já existe cadastro com esse telefone
      if (!forceUpdate) {
        const found = await checkUserExists(clean);
        if (found) {
          setExistingUser(found);
          setIsRegistering(false);
          return;
        }
      }

      await register({
        name: name.trim(),
        phone: clean,
        church: church.trim(),
      });

      setSuccessMsg(`Cadastro realizado com sucesso! Seja bem-vindo, ${name.trim()}!`);
      markLoginPromptShown();
      setTimeout(() => {
        onSuccess();
      }, 900);
    } catch {
      setError('Erro ao salvar cadastro. Tente novamente.');
    } finally {
      setIsRegistering(false);
    }
  };

  // ─── AÇÕES QUANDO O NÚMERO JÁ EXISTE NO CADASTRO ──────────────────────────
  const handleEnterWithExisting = async () => {
    if (!existingUser?.phone) return;
    setIsRegistering(true);
    try {
      const result = await loginWithPhone(existingUser.phone);
      if (result.success) {
        setSuccessMsg(`Conta recuperada! Bem-vindo, ${result.user?.name}!`);
        markLoginPromptShown();
        setTimeout(() => {
          onSuccess();
        }, 800);
      }
    } catch {
      setError('Erro ao entrar com a conta existente.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs" onClick={handleDismiss}>
      <div
        className="w-full max-w-md bg-[var(--color-surface)] rounded-t-2xl sm:rounded-2xl p-6 pb-8 shadow-2xl border border-[var(--color-border)]"
        style={{ paddingBottom: `calc(1.5rem + var(--safe-bottom))` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🕊️</span>
            <h2 className="text-lg font-bold text-[var(--color-text)]">
              {tab === 'login' ? 'Acessar Conta' : 'Criar Nova Conta'}
            </h2>
          </div>
          <button
            onClick={handleDismiss}
            className="p-2 rounded-full hover:bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas Alternadoras */}
        <div className="flex rounded-xl bg-[var(--color-surface-alt)] p-1 mb-5 border border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError('');
              setExistingUser(null);
            }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
              tab === 'login'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <LogIn size={16} />
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError('');
              setLoginNotFound(false);
            }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
              tab === 'register'
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <UserPlus size={16} />
            Cadastrar
          </button>
        </div>

        {/* Feedback de Sucesso */}
        {successMsg && (
          <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-emerald-400 text-sm animate-fade-in">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Feedback de Erro */}
        {error && (
          <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-red-400 text-sm animate-fade-in">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
              {loginNotFound && (
                <button
                  type="button"
                  onClick={() => {
                    setRegisterPhone(loginPhone);
                    setTab('register');
                    setError('');
                    setLoginNotFound(false);
                  }}
                  className="mt-2 text-xs font-semibold text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                >
                  <UserPlus size={14} />
                  Criar conta com este telefone agora
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── ABA DE LOGIN ─── */}
        {tab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3.5">
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Informe seu telefone para recuperar seu perfil, histórico de orações e doações.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                Telefone cadastrado
              </label>
              <input
                type="tel"
                placeholder="(98) 98765-4321"
                value={loginPhone}
                onChange={(e) => {
                  setLoginPhone(formatPhone(e.target.value));
                  if (error) setError('');
                  if (loginNotFound) setLoginNotFound(false);
                }}
                className="w-full px-4 py-3 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                autoComplete="tel"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn || Boolean(successMsg)}
              className="w-full py-3.5 mt-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Buscando conta...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Acessar minha conta
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Continuar navegando sem entrar
            </button>
          </form>
        )}

        {/* ─── ABA DE CADASTRO ─── */}
        {tab === 'register' && (
          <div>
            {/* Aviso de número já existente */}
            {existingUser ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4 text-sm text-[var(--color-text)] flex flex-col gap-3">
                <div className="flex items-start gap-2.5 text-amber-400">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Este telefone já possui cadastro!</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      Encontramos uma conta em nome de <strong>{existingUser.name}</strong>
                      {existingUser.church ? ` (${existingUser.church})` : ''}.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleEnterWithExisting}
                    disabled={isRegistering}
                    className="flex-1 py-2.5 px-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogIn size={15} />
                    Entrar como {existingUser.name.split(' ')[0]}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleRegisterSubmit(e, true)}
                    disabled={isRegistering}
                    className="py-2.5 px-3 bg-[var(--color-surface-alt)] hover:bg-[var(--color-surface-alt)]/80 text-[var(--color-text)] border border-[var(--color-border)] text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    Atualizar dados e entrar
                  </button>
                </div>
              </div>
            ) : null}

            <form onSubmit={(e) => handleRegisterSubmit(e, false)} className="flex flex-col gap-3">
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Cadastre-se para salvar seu progresso de leitura, pedidos de oração e contribuições.
              </p>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-muted)]">
                  Nome completo
                </label>
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                  autoComplete="name"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-muted)]">
                  Telefone com DDD
                </label>
                <input
                  type="tel"
                  placeholder="(98) 98765-4321"
                  value={registerPhone}
                  onChange={(e) => setRegisterPhone(formatPhone(e.target.value))}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                  autoComplete="tel"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-muted)]">
                  Igreja / Congregação (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Igreja Batista da Aliança"
                  value={church}
                  onChange={(e) => setChurch(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isRegistering || Boolean(successMsg)}
                className="w-full py-3.5 mt-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                {isRegistering ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Validando e cadastrando...
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Cadastrar
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="w-full py-2.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                Pular por enquanto
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
