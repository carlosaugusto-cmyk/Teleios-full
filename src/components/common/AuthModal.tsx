import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LogIn,
  X,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  Lock,
  User as UserIcon,
  Loader2,
} from 'lucide-react';
import { TeleiosLogo } from './TeleiosLogo.tsx';
import { LoginCredentials, AuthSession } from '../../types/index.ts';
import { saveSession, sanitizeString } from '../../services/security.service.ts';
import { apiFetch } from '../../services/api.service.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (session: AuthSession) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [credentials, setCredentials] = useState<LoginCredentials>({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedSeconds, setLockedSeconds] = useState<number | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  // Rate limiting local: rastrear tentativas por sessão de componente
  const attemptCountRef = useRef<number>(0);
  const lastAttemptRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => usernameRef.current?.focus(), 100);
      setError(null);
      setCredentials({ username: '', password: '' });
      setShowPassword(false);
      attemptCountRef.current = 0;
    }
  }, [isOpen]);

  // Countdown do timer de bloqueio
  useEffect(() => {
    if (!lockedSeconds || lockedSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockedSeconds((prev) => {
        if (!prev || prev <= 1) {
          setError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    // Rate limiting no frontend: máximo 10 tentativas por 60 segundos nesta sessão
    const now = Date.now();
    if (now - lastAttemptRef.current < 1000) return; // debounce de 1s
    lastAttemptRef.current = now;
    attemptCountRef.current += 1;

    if (attemptCountRef.current > 10) {
      setError('Muitas tentativas. Aguarde antes de tentar novamente.');
      return;
    }

    const username = sanitizeString(credentials.username);
    const password = credentials.password; // Senha não é sanitizada para preservar caracteres especiais

    if (!username || !password) {
      setError('Preencha o usuário e a senha.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (response.ok && result.success && result.session) {
        const session: AuthSession = result.session;

        saveSession(session);
        onLoginSuccess(session);
      } else {
        setError(result.error || 'Credenciais inválidas.');
        if (result.lockedSeconds) {
          setLockedSeconds(result.lockedSeconds);
        }
      }
    } catch (err: any) {
      setError('Erro interno. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatLockTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            style={{ backgroundColor: '#111827', border: '1px solid #374151' }}
          >
            {/* Header com identidade visual Teleios */}
            <div className="px-8 pt-8 pb-6 text-white relative" style={{ background: 'linear-gradient(135deg, #0F2B5C 0%, #0077C8 100%)' }}>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer min-h-[44px] flex items-center justify-center"
                title="Fechar"
              >
                <X className="w-4.5 h-4.5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12">
                  <TeleiosLogo variant="icon" size="sm" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-white/50 block">
                    MINISTÉRIO
                  </span>
                  <span className="font-serif text-2xl font-bold italic text-white leading-none block">
                    Teleios
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-brand-gold rounded-md flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-brand-navy" />
                </div>
                <div>
                  <h2 className="text-lg font-serif font-bold text-white leading-tight">
                    Acesso Administrativo
                  </h2>
                  <p className="text-xs text-white/60">
                    Área restrita — Somente para a equipe autorizada
                  </p>
                </div>
              </div>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4" style={{ backgroundColor: '#111827' }}>
              {/* Campo Usuário */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                  Usuário
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
                  <input
                    ref={usernameRef}
                    type="text"
                    value={credentials.username}
                    onChange={(e) =>
                      setCredentials((prev) => ({ ...prev, username: e.target.value }))
                    }
                    placeholder="Digite seu usuário"
                    autoComplete="username"
                    spellCheck={false}
                    disabled={isLoading || !!lockedSeconds}
                    className="w-full pl-9 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 min-h-[52px]"
                    style={{ backgroundColor: '#1F2937', border: '2px solid #374151', color: '#F9FAFB', focusRingColor: '#0077C8' } as any}
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={credentials.password}
                    onChange={(e) =>
                      setCredentials((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    disabled={isLoading || !!lockedSeconds}
                    className="w-full pl-9 pr-12 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 min-h-[52px]"
                    style={{ backgroundColor: '#1F2937', border: '2px solid #374151', color: '#F9FAFB' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={isLoading || !!lockedSeconds}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 transition-colors cursor-pointer flex items-center justify-center"
                    style={{ color: '#9CA3AF', minHeight: '44px', minWidth: '44px' }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mensagem de Erro / Bloqueio */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm border ${
                      lockedSeconds
                        ? 'bg-brand-red/10 border-brand-red/30 text-brand-red'
                        : 'bg-brand-gold/10 border-brand-gold/30 text-brand-gold'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{error}</p>
                      {lockedSeconds && (
                        <p className="mt-0.5 font-mono">
                          Desbloqueio em: {formatLockTime(lockedSeconds)}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Botão de Login */}
              <button
                type="submit"
                disabled={isLoading || !!lockedSeconds || !credentials.username || !credentials.password}
                className="w-full py-4 font-bold text-sm uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 transition-colors cursor-pointer shadow-sm min-h-[56px] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#0F2B5C', color: '#F9FAFB' }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Entrar no Painel</span>
                  </>
                )}
              </button>

              {/* Aviso de segurança */}
              <p className="text-center text-xs font-mono pt-1" style={{ color: '#6B7280' }}>
                🔒 Acesso protegido · Sessão de 8h · Bloqueio por tentativas
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
