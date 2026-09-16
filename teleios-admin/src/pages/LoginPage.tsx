import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LogIn,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  User as UserIcon,
  Loader2,
} from 'lucide-react';
import { TeleiosLogo } from '../components/common/TeleiosLogo.tsx';
import { LoginCredentials, AuthSession } from '../types/index.ts';
import { loadSession, saveSession, sanitizeString } from '../services/security.service.ts';
import { apiFetch } from '../services/api.service.ts';
import { PwaInstallButton } from '../components/common/PwaInstallButton.tsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [credentials, setCredentials] = useState<LoginCredentials>({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  const attemptCountRef = useRef<number>(0);
  const lastAttemptRef = useRef<number>(0);

  // Se já estiver logado, redireciona para o Dashboard
  useEffect(() => {
    const existingSession = loadSession();
    if (existingSession && existingSession.token) {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } else {
      usernameRef.current?.focus();
    }
  }, [navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const now = Date.now();
    if (now - lastAttemptRef.current < 1000) return; // debounce de 1s
    lastAttemptRef.current = now;
    attemptCountRef.current += 1;

    if (attemptCountRef.current > 10) {
      setError('Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.');
      return;
    }

    const username = sanitizeString(credentials.username);
    const password = credentials.password;

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
        const destination = (location.state as any)?.from?.pathname || '/';
        navigate(destination, { replace: true });
      } else {
        setError(result.error || 'Credenciais inválidas. Tente novamente.');
      }
    } catch {
      setError('Erro de conexão ao comunicar com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-[#F9FAFB] flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#0077C8]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Logo */}
      <div className="w-full max-w-md mb-6 flex flex-col items-center z-10 text-center space-y-2">
        <TeleiosLogo variant="icon" size="md" />
        <h1 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-wide">
          Teleios Admin
        </h1>
        <p className="text-xs text-[#9CA3AF]">
          Painel de Gestão e Operações Centralizadas
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-[#111827] border border-[#374151] rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 relative z-10">
        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
              Usuário
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={usernameRef}
                type="text"
                autoComplete="username"
                required
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                placeholder="admin"
                className="w-full pl-10 pr-4 py-2.5 bg-[#1F2937] border border-[#374151] rounded-xl text-xs text-white placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#0077C8] transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-[#1F2937] border border-[#374151] rounded-xl text-xs text-white placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#0077C8] transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[#0077C8] hover:bg-[#005F9E] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Entrar no Painel</span>
              </>
            )}
          </button>

          {/* Botão para Instalar PWA no Login */}
          <PwaInstallButton variant="login" />
        </form>
      </div>

      <div className="mt-8 text-center text-[11px] text-[#6B7280]">
        &copy; {new Date().getFullYear()} Ministério Teleios &bull; Todos os direitos reservados.
      </div>
    </div>
  );
}
