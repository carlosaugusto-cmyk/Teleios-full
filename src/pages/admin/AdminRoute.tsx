import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  RotateCw,
  Sparkles,
  HardDrive,
  MessageSquare,
  ChevronRight,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { Sidebar } from '../../components/admin/layout/Sidebar.tsx';
import { IngestStudio } from '../../components/admin/views/IngestStudio.tsx';
import { EstudosView } from '../../components/admin/views/EstudosView.tsx';
import { GaleriaView } from '../../components/admin/views/GaleriaView.tsx';
import { VideosView } from '../../components/admin/views/VideosView.tsx';
import { ProjetosView } from '../../components/admin/views/ProjetosView.tsx';
import { QueueSchedulerMonitor } from '../../components/admin/views/QueueSchedulerMonitor.tsx';
import { ConfiguracoesView } from '../../components/admin/views/ConfiguracoesView.tsx';
import WhatsAppView from '../../components/admin/views/WhatsAppView.tsx';
import { AuthModal } from '../../components/common/AuthModal.tsx';
import { SystemStatus, Study, MediaFile, VideoMetadata, AuthSession, PermissionModule } from '../../types/index.ts';
import { loadSession, clearSession, hasPermission } from '../../services/security.service.ts';
import { apiFetch } from '../../services/api.service.ts';

export default function AdminRoute() {
  const [activeTab, setActiveTab] = useState<string>('ingest');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [studies, setStudies] = useState<Study[]>([]);
  const [galeriaFiles, setGaleriaFiles] = useState<MediaFile[]>([]);
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [projetosFiles, setProjetosFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const navigate = useNavigate();

  // Load session on mount
  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setSession(saved);
    } else {
      // Not authenticated — show login modal
      setAuthModalOpen(true);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statusRes, estudosRes, galeriaRes, videosRes, projetosRes] = await Promise.all([
        apiFetch('/api/status'),
        apiFetch('/api/estudos'),
        apiFetch('/api/galeria'),
        apiFetch('/api/videos'),
        apiFetch('/api/projetos'),
      ]);
      const parseApiResponse = async (response: Response) => {
        const responseText = await response.text();
        try {
          return responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new Error(`A API retornou uma resposta inválida (HTTP ${response.status}). Confirme que o servidor está em execução.`);
        }
      };
      const [statusData, estudosData, galeriaData, videosData, projetosData] = await Promise.all([
        parseApiResponse(statusRes),
        parseApiResponse(estudosRes),
        parseApiResponse(galeriaRes),
        parseApiResponse(videosRes),
        parseApiResponse(projetosRes),
      ]);
      if (statusData.success) setSystemStatus(statusData.data);
      if (estudosData.success) setStudies(estudosData.data);
      if (galeriaData.success) setGaleriaFiles(galeriaData.data);
      if (videosData.success) setVideos(videosData.data);
      if (projetosData.success) setProjetosFiles(projetosData.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchAllData();
  }, [session]);

  const handleLoginSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    setAuthModalOpen(false);
    fetchAllData();
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    navigate('/');
  };

  const canAccess = useCallback(
    (module: PermissionModule): boolean => {
      if (!session) return false;
      return hasPermission(session.user.permissions as string[], module);
    },
    [session]
  );

  const tabLabels: Record<string, string> = {
    ingest: 'Novo Arquivo',
    estudos: 'Estudos',
    galeria: 'Galeria',
    videos: 'Vídeos',
    projetos: 'Projetos',
    queues: 'Automações',
    whatsapp: 'WhatsApp',
    config: 'Configurações',
  };

  useEffect(() => {
    if (session) {
      const currentTabModule = activeTab as PermissionModule;
      if (!canAccess(currentTabModule) && !canAccess('*')) {
        const firstAccessible = Object.keys(tabLabels).find((tab) => canAccess(tab as PermissionModule));
        if (firstAccessible) setActiveTab(firstAccessible);
      }
    }
  }, [session, activeTab]);

  // Show auth modal if not logged in
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0F1A' }}>
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => navigate('/')}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

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
        onOpenPublicSite={() => navigate('/')}
        userPermissions={userPermissions}
        userDisplayName={session.user.displayName}
        userRole={session.user.role}
        onLogout={handleLogout}
      />

      {/* Main Workspace */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen">
        {/* Top Header Bar — Dark */}
        <header
          className="sticky top-0 z-30 border-b px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4"
          style={{ backgroundColor: '#111827', borderColor: '#374151' }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-lg lg:hidden transition-colors cursor-pointer"
              style={{ backgroundColor: '#1F2937', color: '#F9FAFB' }}
              title="Abrir Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <span style={{ color: '#9CA3AF' }}>Admin</span>
              <ChevronRight className="w-4 h-4" style={{ color: '#4B5563' }} />
              <span className="font-bold" style={{ color: '#F9FAFB' }}>
                {tabLabels[activeTab] || 'Workspace'}
              </span>
            </div>
          </div>

          {/* Right: Status + Actions */}
          <div className="flex items-center gap-3">
            {/* User badge */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: '#F9FAFB' }}>
                {session.user.displayName}
              </span>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg transition-colors cursor-pointer hover:bg-red-500/10 hover:text-red-500"
              style={{ color: '#9CA3AF' }}
              title="Encerrar sessão"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* View Container */}
        <main
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto"
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
              {activeTab === 'ingest' && canAccess('ingest') && (
                <IngestStudio
                  onUploadSuccess={fetchAllData}
                  onNavigateToEstudos={() => {
                    fetchAllData();
                    setActiveTab('estudos');
                  }}
                />
              )}
              {activeTab === 'estudos' && canAccess('estudos') && (
                <EstudosView studies={studies} onRefresh={fetchAllData} />
              )}
              {activeTab === 'galeria' && canAccess('galeria') && (
                <GaleriaView files={galeriaFiles} onRefresh={fetchAllData} />
              )}
              {activeTab === 'videos' && canAccess('videos') && (
                <VideosView videos={videos} onRefresh={fetchAllData} />
              )}
              {activeTab === 'projetos' && canAccess('projetos') && (
                <ProjetosView files={projetosFiles} onRefresh={fetchAllData} />
              )}
              {activeTab === 'queues' && canAccess('queues') && (
                <QueueSchedulerMonitor systemStatus={systemStatus} onRefresh={fetchAllData} />
              )}
              {activeTab === 'whatsapp' && canAccess('whatsapp') && <WhatsAppView />}
              {activeTab === 'config' && canAccess('config') && (
                <ConfiguracoesView
                  systemStatus={systemStatus}
                  onRefreshStatus={fetchAllData}
                  currentUserId={session.user.id}
                  isSuperadmin={session.user.role === 'superadmin'}
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
