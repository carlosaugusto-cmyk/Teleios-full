import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar.tsx';
import { EstudosDevocionaisManager } from '../components/views/EstudosDevocionaisManager.tsx';
import { UsuariosView } from '../components/views/UsuariosView.tsx';
import { ControleFinanceiroView } from '../components/views/ControleFinanceiroView.tsx';
import { IntegracoesView } from '../components/views/IntegracoesView.tsx';
import { SystemStatus, MediaFile, VideoMetadata, AuthSession, PermissionModule } from '../types/index.ts';
import { loadSession, clearSession, hasPermission } from '../services/security.service.ts';
import { safeApiFetch } from '../utils/contentSanitizer.ts';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  const [activeTab, setActiveTab] = useState<string>('estudos_devocionais');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [galeriaFiles, setGaleriaFiles] = useState<MediaFile[]>([]);
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Se o usuário não estiver autenticado, redireciona diretamente para /login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statusRes, galeriaRes, videosRes] = await Promise.all([
        safeApiFetch<any>('/api/status'),
        safeApiFetch<MediaFile[]>('/api/galeria'),
        safeApiFetch<VideoMetadata[]>('/api/videos'),
      ]);

      if (statusRes.success && statusRes.data) {
        setSystemStatus(statusRes.data.data || statusRes.data);
      }
      if (galeriaRes.success && Array.isArray(galeriaRes.data)) {
        setGaleriaFiles(galeriaRes.data);
      }
      if (videosRes.success && Array.isArray(videosRes.data)) {
        setVideos(videosRes.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do admin:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchAllData();
  }, [session, fetchAllData]);

  const handleLogout = () => {
    clearSession();
    setSession(null);
    navigate('/login', { replace: true });
  };

  const canAccess = useCallback(
    (module: PermissionModule): boolean => {
      if (!session) return false;
      return hasPermission(session.user.permissions as string[], module);
    },
    [session]
  );

  const tabLabels: Record<string, string> = {
    estudos_devocionais: 'Estudos & Devocionais',
    usuarios: 'Usuários',
    financeiro: 'Controle Financeiro',
    inscricoes: 'Usuários',
    estudos: 'Estudos & Devocionais',
    devocionais: 'Estudos & Devocionais',
    integracoes: 'Integrações',
  };

  useEffect(() => {
    if (session) {
      const currentTabModule = activeTab as PermissionModule;
      if (!canAccess(currentTabModule) && !canAccess('*')) {
        const firstAccessible = Object.keys(tabLabels).find((tab) => canAccess(tab as PermissionModule));
        if (firstAccessible) setActiveTab(firstAccessible);
      }
    }
  }, [session, activeTab, canAccess]);

  const userPermissions = session.user.permissions as string[];

  return (
    <div
      className="min-h-screen flex font-sans"
      style={{ backgroundColor: '#0A0F1A', color: '#F9FAFB' }}
    >
      {/* Platform Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        systemStatus={systemStatus}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onOpenPublicSite={() => window.open(import.meta.env.VITE_PUBLIC_SITE_URL || '/', '_blank')}
        userPermissions={userPermissions}
        userDisplayName={session.user.displayName}
        userRole={session.user.role}
        onLogout={handleLogout}
      />

      {/* Main Workspace */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen min-w-0 w-full overflow-x-hidden">
        {/* Top Header Bar — Limpo: Apenas Nome da Página e Botão de Sair */}
        <header
          className="sticky top-0 z-30 border-b px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-4"
          style={{ backgroundColor: '#111827', borderColor: '#374151' }}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Mobile Hamburger (visível somente em telas pequenas para navegação) */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-lg lg:hidden transition-colors cursor-pointer shrink-0"
              style={{ backgroundColor: '#1F2937', color: '#F9FAFB' }}
              title="Abrir Menu"
              aria-label="Abrir Menu de Navegação"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Nome da Página */}
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
              {tabLabels[activeTab] || 'Workspace'}
            </h1>
          </div>

          {/* Botão de Sair */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 transition-colors cursor-pointer shrink-0 shadow-sm"
            title="Encerrar sessão"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </header>

        {/* View Container */}
        <main
          className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0"
          style={{ color: '#F9FAFB' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {(activeTab === 'estudos_devocionais' || activeTab === 'estudos' || activeTab === 'devocionais') &&
                (canAccess('estudos') || canAccess('devocionais') || canAccess('*')) && (
                <EstudosDevocionaisManager defaultTab={activeTab === 'estudos' ? 'estudos' : 'devocionais'} />
              )}
              {(activeTab === 'usuarios' || activeTab === 'inscricoes') && (canAccess('estudos') || canAccess('*')) && (
                <UsuariosView />
              )}
              {activeTab === 'financeiro' && (canAccess('estudos') || canAccess('*')) && (
                <ControleFinanceiroView />
              )}
              {activeTab === 'integracoes' && canAccess('integracoes') && (
                <IntegracoesView
                  systemStatus={systemStatus}
                  onRefreshStatus={fetchAllData}
                />
              )}

              {/* Acesso negado */}
              {!canAccess(activeTab as PermissionModule) && (
                <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: '#1F2937' }}
                  >
                    <ShieldCheck className="w-8 h-8" style={{ color: '#4B5563' }} />
                  </div>
                  <h3 className="text-xl font-bold" style={{ color: '#F9FAFB' }}>
                    Acesso Restrito
                  </h3>
                  <p className="text-sm max-w-sm" style={{ color: '#9CA3AF' }}>
                    Você não possui permissão para acessar este módulo. Contate o administrador.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
