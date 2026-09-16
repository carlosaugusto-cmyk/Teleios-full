import React, { useState, useEffect, useRef } from 'react';
import {
  HardDrive,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  Download,
  Database,
  ArrowDownToLine,
  MessageCircle,
  QrCode,
  Save,
  Check,
  Folder,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Sliders,
  Info,
  UploadCloud,
  Send,
  Key,
  Lock,
  Search,
  X,
  Copy,
  LogOut,
  Globe,
  User,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SystemStatus, BackupStatus, GeminiConfig, GoogleDriveConfig, DriveFileItem } from '../../types/index.ts';
import { apiFetch } from '../../services/api.service.ts';
import { WaDestination, getSavedChannels, getGlobalWhatsAppChannel } from '../../services/whatsappChannels.service.ts';
import WhatsAppView from './WhatsAppView.tsx';

interface IntegracoesViewProps {
  systemStatus: SystemStatus | null;
  onRefreshStatus: () => void;
}

type TabType = 'whatsapp' | 'drive' | 'gemini';

export const IntegracoesView: React.FC<IntegracoesViewProps> = ({
  systemStatus,
  onRefreshStatus,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('whatsapp');

  // Drive configuration & OAuth 2.0 state
  const [driveClientId, setDriveClientId] = useState('');
  const [driveClientSecret, setDriveClientSecret] = useState('');
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [driveRedirectUri, setDriveRedirectUri] = useState('');
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [isDisconnectingDrive, setIsDisconnectingDrive] = useState(false);
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);
  const [showAdvancedDrive, setShowAdvancedDrive] = useState(false);

  // Drive legacy/Service Account state
  const [driveEmail, setDriveEmail] = useState('');
  const [drivePrivateKey, setDrivePrivateKey] = useState('');
  const [driveRootFolderId, setDriveRootFolderId] = useState('');
  const [driveFolder, setDriveFolder] = useState('Teleios');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [driveStatus, setDriveStatus] = useState<GoogleDriveConfig | null>(null);
  const [isVerifyingDrive, setIsVerifyingDrive] = useState(false);
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [driveFeedback, setDriveFeedback] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  // Drive Explorer & File Browser state
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [driveSearch, setDriveSearch] = useState('');
  const [driveFilter, setDriveFilter] = useState<'all' | 'document' | 'image' | 'video' | 'folder'>('all');
  const [currentFolderId, setCurrentFolderId] = useState<string>('');
  const [folderTrail, setFolderTrail] = useState<Array<{ id: string; name: string }>>([]);

  // Drive Import Modal state
  const [importModalFile, setImportModalFile] = useState<DriveFileItem | null>(null);
  const [importCategory, setImportCategory] = useState<'ESTUDO' | 'GALERIA' | 'VIDEO' | 'APOIO'>('ESTUDO');
  const [importTitle, setImportTitle] = useState('');
  const [importAutoDispatch, setImportAutoDispatch] = useState(false);
  const [importChannelId, setImportChannelId] = useState('');
  const [importPhone, setImportPhone] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ success: boolean; text: string } | null>(null);

  // Drive Direct Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ success: boolean; text: string } | null>(null);

  // WhatsApp Channels for dispatch
  const [waChannels, setWaChannels] = useState<WaDestination[]>(getSavedChannels);
  const [globalWaChannel, setGlobalWaChannel] = useState<WaDestination | null>(() => getGlobalWhatsAppChannel());

  // Gemini state
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');
  const [geminiStatus, setGeminiStatus] = useState<GeminiConfig | null>(null);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [geminiFeedback, setGeminiFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Backup state
  const [isDoingBackup, setIsDoingBackup] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [backupStatus, setBackupStatus] = useState<any | null>(null);

  // Carregar configurações reais do backend
  const loadAdminConfigs = async () => {
    try {
      const res = await apiFetch('/api/config/admin');
      const json = await res.json();
      if (json.success && json.data) {
        const { gemini, googleDrive } = json.data;
        if (gemini) {
          setGeminiStatus(gemini);
          setGeminiModel(gemini.model || 'gemini-1.5-flash');
        }
        if (googleDrive) {
          setDriveStatus(googleDrive);
          setDriveClientId(googleDrive.clientId || '');
          setDriveClientSecret(googleDrive.clientSecretMasked || '');
          setDriveRedirectUri(googleDrive.redirectUri || '');
          setDriveEmail(googleDrive.serviceAccountEmail || googleDrive.user?.emailAddress || '');
          setDriveFolder(googleDrive.rootFolderName || 'Teleios');
          setDriveRootFolderId(googleDrive.rootFolderId || '');
          if (googleDrive.privateKey) {
            setDrivePrivateKey(googleDrive.privateKey);
          }
          if (googleDrive.configured) {
            loadDriveFiles(googleDrive.rootFolderId || undefined);
          }
        }
      }
    } catch {}
  };

  const loadBackupStatus = async () => {
    try {
      const res = await apiFetch('/api/backup/status');
      const data = await res.json();
      if (data.success && data.data) {
        setBackupStatus(data.data);
      }
    } catch {}
  };

  useEffect(() => {
    loadAdminConfigs();
    loadBackupStatus();
    setWaChannels(getSavedChannels());
    setGlobalWaChannel(getGlobalWhatsAppChannel());

    // Listener para retorno de sucesso do popup Google OAuth
    const handleAuthMessage = (e: MessageEvent) => {
      if (e.data?.type === 'GOOGLE_DRIVE_AUTH_SUCCESS') {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        setDriveFeedback({
          success: true,
          message: `Google Drive conectado com sucesso para ${e.data.email || 'sua conta'}!`
        });
        loadAdminConfigs();
        onRefreshStatus();
        loadDriveFiles();
      } else if (e.data?.type === 'GOOGLE_DRIVE_AUTH_ERROR') {
        setDriveFeedback({
          success: false,
          message: `Falha na autorização do Google Drive: ${e.data.error}`
        });
      }
    };
    window.addEventListener('message', handleAuthMessage);

    // Fallback se redirecionado na mesma aba
    if (window.location.hash.includes('auth=success')) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      setDriveFeedback({ success: true, message: 'Google Drive conectado com sucesso!' });
      loadAdminConfigs();
      onRefreshStatus();
      loadDriveFiles();
    }

    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  // ─── GOOGLE DRIVE HANDLERS (OAUTH 2.0 & SERVICE ACCOUNT) ────────────────────

  const handleCopyRedirectUri = () => {
    const uri = driveRedirectUri || `${window.location.origin.replace(':5173', ':8787')}/api/auth/google/callback`;
    navigator.clipboard.writeText(uri);
    setCopiedRedirectUri(true);
    setTimeout(() => setCopiedRedirectUri(false), 2500);
  };

  const handleConnectGoogleOAuth = async () => {
    setIsConnectingOAuth(true);
    setDriveFeedback(null);
    try {
      // Salva Client ID e Secret se alterados
      if (driveClientId.trim() || (driveClientSecret.trim() && !driveClientSecret.includes('••••'))) {
        await apiFetch('/api/config/admin', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googleDrive: {
              clientId: driveClientId.trim(),
              clientSecret: driveClientSecret.trim(),
              redirectUri: driveRedirectUri.trim() || undefined,
              rootFolderId: driveRootFolderId.trim() || undefined,
              rootFolderName: driveFolder.trim() || undefined,
            },
          }),
        });
      }

      const res = await apiFetch(`/api/integrations/drive/auth-url?adminOrigin=${encodeURIComponent(window.location.origin)}`);
      const data = await res.json();

      if (data.success && data.authUrl) {
        const width = 560;
        const height = 650;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const popup = window.open(
          data.authUrl,
          'google_drive_oauth',
          `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes`
        );
        if (!popup || popup.closed) {
          window.location.href = data.authUrl;
        }
      } else {
        setShowAdvancedDrive(true);
        setDriveFeedback({
          success: false,
          message: 'Para ativar o login do Google, insira o Client ID e Client Secret do seu Google Cloud.',
        });
      }
    } catch {
      setDriveFeedback({ success: false, message: 'Erro ao conectar à API do Google OAuth.' });
    } finally {
      setIsConnectingOAuth(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!confirm('Deseja realmente desconectar seu Google Drive do Teleios?')) return;
    setIsDisconnectingDrive(true);
    setDriveFeedback(null);
    try {
      const res = await apiFetch('/api/integrations/drive/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDriveFeedback({ success: true, message: 'Google Drive desconectado com sucesso.' });
        loadAdminConfigs();
        onRefreshStatus();
        setDriveFiles([]);
      } else {
        setDriveFeedback({ success: false, message: data.error || 'Erro ao desconectar.' });
      }
    } catch {
      setDriveFeedback({ success: false, message: 'Erro ao comunicar com o servidor.' });
    } finally {
      setIsDisconnectingDrive(false);
    }
  };

  const handleSaveDrive = async () => {
    setIsSavingDrive(true);
    setDriveFeedback(null);
    try {
      const payload: any = {
        mode: driveStatus?.mode || (driveStatus?.connected ? 'oauth' : 'oauth'),
        clientId: driveClientId.trim(),
        redirectUri: driveRedirectUri.trim() || undefined,
        rootFolderName: driveFolder.trim(),
        rootFolderId: driveRootFolderId.trim(),
        serviceAccountEmail: driveEmail.trim(),
      };
      if (driveClientSecret.trim() && !driveClientSecret.includes('••••')) {
        payload.clientSecret = driveClientSecret.trim();
      }
      if (drivePrivateKey.trim() && !drivePrivateKey.includes('••••')) {
        payload.privateKey = drivePrivateKey.trim();
      }

      const res = await apiFetch('/api/config/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleDrive: payload }),
      });
      const json = await res.json();
      if (json.success) {
        setDriveFeedback({ success: true, message: 'Configurações do Google Drive salvas com sucesso!' });
        loadAdminConfigs();
      } else {
        setDriveFeedback({ success: false, message: json.error || 'Erro ao salvar configurações.' });
      }
    } catch {
      setDriveFeedback({ success: false, message: 'Erro de conexão ao salvar Google Drive.' });
    } finally {
      setIsSavingDrive(false);
      setTimeout(() => setDriveFeedback(null), 6000);
    }
  };

  const handleTestDrive = async () => {
    setIsVerifyingDrive(true);
    setDriveFeedback(null);
    try {
      const payload: any = {
        rootFolderId: driveRootFolderId.trim() || undefined,
        rootFolderName: driveFolder.trim() || undefined,
      };
      if (driveEmail.trim()) payload.serviceAccountEmail = driveEmail.trim();
      if (drivePrivateKey.trim() && !drivePrivateKey.includes('••••')) payload.privateKey = drivePrivateKey.trim();

      const res = await apiFetch('/api/integrations/drive/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        let extraInfo = '';
        if (json.quota?.limit) {
          const usedGB = ((Number(json.quota.usage || 0)) / (1024 * 1024 * 1024)).toFixed(2);
          const totalGB = ((Number(json.quota.limit || 0)) / (1024 * 1024 * 1024)).toFixed(2);
          extraInfo = ` | Cota: ${usedGB} GB de ${totalGB} GB usados`;
        }
        setDriveFeedback({
          success: true,
          message: `${json.message}${extraInfo}`,
          details: json,
        });
        loadAdminConfigs();
        onRefreshStatus();
        loadDriveFiles(driveRootFolderId.trim() || undefined);
      } else {
        setDriveFeedback({
          success: false,
          message: json.error || 'Falha ao testar conexão com o Google Drive.',
        });
      }
    } catch {
      setDriveFeedback({ success: false, message: 'Erro ao conectar à API do Google Drive.' });
    } finally {
      setIsVerifyingDrive(false);
    }
  };

  // ─── DRIVE EXPLORER METHODS ─────────────────────────────────────────────────

  const loadDriveFiles = async (folderId?: string, search?: string, filter?: string) => {
    setIsLoadingDriveFiles(true);
    try {
      const params = new URLSearchParams();
      if (folderId) params.set('folderId', folderId);
      if (search) params.set('search', search);
      if (filter && filter !== 'all') params.set('filter', filter);

      const res = await apiFetch(`/api/integrations/drive/files?${params.toString()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.files)) {
        setDriveFiles(json.files);
      }
    } catch (err) {
      console.error('Erro ao carregar arquivos do Drive:', err);
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  const handleOpenFolder = (folder: DriveFileItem) => {
    setCurrentFolderId(folder.id);
    setFolderTrail((prev) => [...prev, { id: folder.id, name: folder.name }]);
    loadDriveFiles(folder.id, driveSearch, driveFilter);
  };

  const handleNavigateBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentFolderId(driveRootFolderId || '');
      setFolderTrail([]);
      loadDriveFiles(driveRootFolderId || undefined, driveSearch, driveFilter);
    } else {
      const target = folderTrail[index];
      const newTrail = folderTrail.slice(0, index + 1);
      setCurrentFolderId(target.id);
      setFolderTrail(newTrail);
      loadDriveFiles(target.id, driveSearch, driveFilter);
    }
  };

  const handleOpenImportModal = (file: DriveFileItem) => {
    setImportModalFile(file);
    setImportTitle(file.name.replace(/\.[^.]+$/, ''));
    let defaultCat: 'ESTUDO' | 'GALERIA' | 'VIDEO' | 'APOIO' = 'ESTUDO';
    if (file.mimeType.startsWith('image/')) defaultCat = 'GALERIA';
    else if (file.mimeType.startsWith('video/')) defaultCat = 'VIDEO';
    setImportCategory(defaultCat);
    setImportAutoDispatch(false);
    setImportFeedback(null);
  };

  const handleExecuteImport = async () => {
    if (!importModalFile) return;
    setIsImporting(true);
    setImportFeedback(null);

    try {
      const res = await apiFetch('/api/integrations/drive/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: importModalFile.id,
          category: importCategory,
          title: importTitle.trim() || importModalFile.name,
          autoDispatchWhatsapp: importAutoDispatch,
          channelId: importChannelId || globalWaChannel?.jid || globalWaChannel?.id || undefined,
          targetPhone: importPhone.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        setImportFeedback({
          success: true,
          text: json.message || 'Arquivo importado com sucesso para a plataforma!',
        });
        onRefreshStatus();
        setTimeout(() => {
          setImportModalFile(null);
          setImportFeedback(null);
        }, 2500);
      } else {
        throw new Error(json.error || 'Falha ao importar arquivo do Google Drive.');
      }
    } catch (err: any) {
      setImportFeedback({ success: false, text: err.message || 'Erro ao importar arquivo.' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExecuteUploadToDrive = async () => {
    if (!uploadFile) return;
    setIsUploadingDrive(true);
    setUploadFeedback(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('fileName', uploadFile.name);
      formData.append('mimeType', uploadFile.type || 'application/octet-stream');

      const res = await apiFetch('/api/integrations/drive/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.success) {
        confetti({ particleCount: 50, spread: 50 });
        setUploadFeedback({ success: true, text: 'Upload para o Google Drive concluído com sucesso!' });
        loadDriveFiles(currentFolderId || driveRootFolderId || undefined);
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadFile(null);
          setUploadFeedback(null);
        }, 2000);
      } else {
        throw new Error(json.error || 'Falha no upload para o Drive.');
      }
    } catch (err: any) {
      setUploadFeedback({ success: false, text: err.message || 'Erro no upload.' });
    } finally {
      setIsUploadingDrive(false);
    }
  };

  // ─── GEMINI HANDLERS ────────────────────────────────────────────────────────

  const handleSaveGemini = async () => {
    setIsSavingGemini(true);
    setGeminiFeedback(null);
    try {
      const payload: any = { model: geminiModel };
      if (geminiKey.trim()) payload.apiKey = geminiKey.trim();

      const res = await apiFetch('/api/config/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gemini: payload }),
      });
      const json = await res.json();
      if (json.success) {
        setGeminiFeedback({ success: true, message: 'Configurações do Gemini salvas!' });
        setGeminiKey('');
        loadAdminConfigs();
      } else {
        setGeminiFeedback({ success: false, message: json.error || 'Erro ao salvar.' });
      }
    } catch {
      setGeminiFeedback({ success: false, message: 'Erro de conexão.' });
    } finally {
      setIsSavingGemini(false);
      setTimeout(() => setGeminiFeedback(null), 5000);
    }
  };

  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    setGeminiFeedback(null);
    try {
      const res = await apiFetch('/api/integrations/gemini/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: geminiKey.trim() || undefined,
          model: geminiModel,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setGeminiFeedback({
          success: true,
          message: `${json.message} (Resposta da IA: "${json.response}")`,
        });
        loadAdminConfigs();
        onRefreshStatus();
      } else {
        setGeminiFeedback({
          success: false,
          message: json.error || 'Chave de API inválida ou sem permissão.',
        });
      }
    } catch {
      setGeminiFeedback({ success: false, message: 'Erro de conexão com a API do Gemini.' });
    } finally {
      setIsTestingGemini(false);
      setTimeout(() => setGeminiFeedback(null), 7000);
    }
  };

  // ─── BACKUP MANUAL TRIGGER ──────────────────────────────────────────────────

  const handleRunBackup = async () => {
    setIsDoingBackup(true);
    setBackupFeedback(null);
    try {
      const res = await apiFetch('/api/backup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBackupFeedback({ success: true, message: 'Lote de backup sincronizado com sucesso!' });
        await loadBackupStatus();
      } else {
        setBackupFeedback({ success: false, message: data.error || 'Erro ao executar backup.' });
      }
    } catch {
      setBackupFeedback({ success: false, message: 'Erro de conexão ao sincronizar backup.' });
    } finally {
      setIsDoingBackup(false);
      setTimeout(() => setBackupFeedback(null), 5000);
    }
  };

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    try {
      const res = await apiFetch('/api/backup');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `teleios-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setBackupFeedback({ success: false, message: 'Erro ao baixar arquivo de backup.' });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto font-sans pb-16 min-w-0 w-full">
      {/* Top Header */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-serif font-bold text-white tracking-tight flex items-center gap-2 sm:gap-2.5">
          <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-[#0077C8] shrink-0" />
          <span>Hub Central de Integrações</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#9CA3AF] mt-1 leading-relaxed">
          Gerencie e monitore as conexões do WhatsApp, Google Drive e Google Gemini AI.
        </p>
      </div>

      {/* Navegação de Abas - Scroll horizontal suave no mobile */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-[#374151] pb-3 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
        {[
          { id: 'whatsapp', label: 'WhatsApp (Agente & Canais)', icon: MessageCircle },
          { id: 'drive', label: 'Google Drive & Backup', icon: HardDrive },
          { id: 'gemini', label: 'Google Gemini AI', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap ${
                isActive
                  ? 'bg-[#0077C8] text-white shadow'
                  : 'bg-[#111827] text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] border border-[#374151]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── ABA 1: WHATSAPP ────────────────────────────────────────────────── */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-4">
          <div className="p-3 sm:p-4 bg-[#1F2937]/50 rounded-xl border border-[#374151] text-xs text-[#9CA3AF] leading-relaxed">
            O serviço do WhatsApp opera com o agente Go local conectado ao Cloudflare Worker via WebSocket. Todos os disparos e agendamentos persistem de forma autônoma.
          </div>
          <WhatsAppView />
        </div>
      )}

      {/* ─── ABA 2: GOOGLE DRIVE & BACKUP ───────────────────────────────────── */}
      {activeTab === 'drive' && (
        <div className="space-y-5 sm:space-y-6">
          {/* Card de Conexão Google Drive (OAuth 2.0 Nativo) */}
          <div className="bg-[#111827] border border-[#374151] rounded-2xl p-5 sm:p-7 space-y-6 shadow-sm">
            {/* SE ESTIVER CONECTADO: Card Limpo com Avatar, Cota e Botões Simples */}
            {driveStatus?.connected || (driveStatus?.configured && driveStatus?.mode === 'oauth') ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full bg-emerald-950 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0 overflow-hidden font-bold shadow">
                      {driveStatus.user?.photoLink ? (
                        <img src={driveStatus.user.photoLink} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-base">
                          {driveStatus.user?.displayName || 'Google Drive Conectado'}
                        </h4>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Conectado (Acesso Total)
                        </span>
                      </div>
                      <p className="text-xs text-[#9CA3AF] font-mono mt-0.5">
                        {driveStatus.user?.emailAddress || driveStatus.serviceAccountEmail || 'Sua Conta Google'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={handleTestDrive}
                      disabled={isVerifyingDrive}
                      className="px-3.5 py-2 bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      title="Atualizar cota e arquivos"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingDrive ? 'animate-spin' : ''}`} />
                      <span>{isVerifyingDrive ? 'Atualizando...' : 'Atualizar'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDisconnectDrive}
                      disabled={isDisconnectingDrive}
                      className="px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 text-rose-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      title="Desconectar do Google Drive"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{isDisconnectingDrive ? 'Desconectando...' : 'Desconectar'}</span>
                    </button>
                  </div>
                </div>

                {/* Métricas de Cota / Armazenamento */}
                {driveStatus.quota && (
                  <div className="p-3.5 bg-[#1F2937]/50 border border-[#374151]/70 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center text-[#9CA3AF]">
                      <span>Armazenamento no Google Drive:</span>
                      <span className="font-mono text-white font-medium">
                        {driveStatus.quota.usage ? `${((Number(driveStatus.quota.usage)) / (1024 * 1024 * 1024)).toFixed(2)} GB` : '0 GB'} de {driveStatus.quota.limit ? `${((Number(driveStatus.quota.limit)) / (1024 * 1024 * 1024)).toFixed(0)} GB` : 'Ilimitado'}
                      </span>
                    </div>
                    {driveStatus.quota.limit && (
                      <div className="w-full bg-[#111827] h-2 rounded-full overflow-hidden border border-[#374151]">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(2, (Number(driveStatus.quota.usage || 0) / Number(driveStatus.quota.limit || 1)) * 100))}%`
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* SE ESTIVER DESCONECTADO */
              <div className="flex flex-col items-center justify-center text-center py-4 space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
                  <HardDrive className="w-7 h-7" />
                </div>

                <div className="max-w-md space-y-1.5">
                  <h4 className="text-lg font-bold text-white tracking-tight">
                    Conectar Google Drive
                  </h4>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">
                    Solicita acesso total aos arquivos da sua conta Google para leitura, upload e gestão direta na plataforma.
                  </p>
                </div>

                {/* Se já tiver Client ID e Secret configurados, exibe o botão direto de 1 clique */}
                {(driveClientId || driveStatus?.clientId) && !showAdvancedDrive ? (
                  <div className="space-y-3 w-full max-w-sm flex flex-col items-center">
                    <button
                      type="button"
                      onClick={handleConnectGoogleOAuth}
                      disabled={isConnectingOAuth}
                      className="w-full px-6 py-3.5 bg-white hover:bg-neutral-100 active:bg-neutral-200 text-gray-900 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>{isConnectingOAuth ? 'Abrindo autorização...' : 'Entrar com o Google'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAdvancedDrive(true)}
                      className="text-[11px] text-[#9CA3AF] hover:text-amber-400 transition cursor-pointer underline"
                    >
                      Alterar chaves do Google Cloud
                    </button>
                  </div>
                ) : (
                  /* Se não tiver Client ID configurado ainda, ou se clicou em alterar chaves */
                  <div className="w-full max-w-lg p-5 bg-[#1F2937]/50 border border-[#374151] rounded-2xl space-y-4 text-left">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#9CA3AF] font-bold">URI de Redirecionamento Autorizada:</span>
                        <button
                          type="button"
                          onClick={handleCopyRedirectUri}
                          className="text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-bold"
                        >
                          {copiedRedirectUri ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedRedirectUri ? 'Copiado!' : 'Copiar URI'}</span>
                        </button>
                      </div>
                      <div className="p-2 bg-[#111827] rounded-lg text-xs font-mono text-amber-300 break-all select-all">
                        {driveRedirectUri || 'https://teleios-api-worker.ca88321499.workers.dev/api/auth/google/callback'}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#9CA3AF] mb-1">Client ID:</label>
                        <input
                          type="text"
                          value={driveClientId}
                          onChange={(e) => setDriveClientId(e.target.value)}
                          placeholder="...apps.googleusercontent.com"
                          className="w-full px-3 py-2 bg-[#111827] border border-[#374151] rounded-lg text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[11px] font-bold text-[#9CA3AF]">Client Secret:</label>
                          <button
                            type="button"
                            onClick={() => setShowClientSecret(!showClientSecret)}
                            className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer"
                          >
                            {showClientSecret ? 'Ocultar' : 'Visualizar'}
                          </button>
                        </div>
                        <input
                          type={showClientSecret ? 'text' : 'password'}
                          value={driveClientSecret}
                          onChange={(e) => setDriveClientSecret(e.target.value)}
                          placeholder="GOCSPX-..."
                          className="w-full px-3 py-2 bg-[#111827] border border-[#374151] rounded-lg text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleConnectGoogleOAuth}
                        disabled={isConnectingOAuth || !driveClientId.trim()}
                        className="flex-1 py-3 bg-white hover:bg-neutral-100 active:bg-neutral-200 text-gray-900 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>{isConnectingOAuth ? 'Conectando...' : 'Salvar e Conectar com o Google'}</span>
                      </button>

                      {driveStatus?.clientId && (
                        <button
                          type="button"
                          onClick={() => setShowAdvancedDrive(false)}
                          className="px-4 py-3 bg-[#111827] hover:bg-[#374151] text-white text-xs font-medium rounded-xl transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mensagem de Feedback / Status */}
            {driveFeedback && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  driveFeedback.success
                    ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                }`}
              >
                {driveFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span className="break-words">{driveFeedback.message}</span>
              </div>
            )}
          </div>

          {/* ─── NAVEGADOR & EXPLORADOR DE ARQUIVOS DO GOOGLE DRIVE ────────────── */}
          <div className="bg-[#111827] border border-[#374151] rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#374151] pb-4">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-amber-400" />
                  <span>Explorador de Arquivos do Google Drive</span>
                </h3>
                <p className="text-xs text-[#9CA3AF]">
                  Acesse arquivos salvos no Drive, importe diretamente para o Teleios e dispare para o WhatsApp.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow flex-1 sm:flex-none"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload para Drive</span>
                </button>
                <button
                  type="button"
                  onClick={() => loadDriveFiles(currentFolderId || driveRootFolderId || undefined, driveSearch, driveFilter)}
                  disabled={isLoadingDriveFiles}
                  className="p-2 bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-white text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
                  title="Atualizar lista"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingDriveFiles ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Breadcrumb de Navegação de Pastas */}
            <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF] overflow-x-auto no-scrollbar py-1">
              <button
                onClick={() => handleNavigateBreadcrumb(-1)}
                className={`flex items-center gap-1 hover:text-white transition cursor-pointer ${
                  folderTrail.length === 0 ? 'text-amber-400 font-bold' : ''
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>{driveFolder || 'Raiz'}</span>
              </button>
              {folderTrail.map((item, idx) => (
                <React.Fragment key={item.id}>
                  <ChevronRight className="w-3.5 h-3.5 text-[#4B5563] shrink-0" />
                  <button
                    onClick={() => handleNavigateBreadcrumb(idx)}
                    className={`hover:text-white transition cursor-pointer truncate max-w-[150px] ${
                      idx === folderTrail.length - 1 ? 'text-amber-400 font-bold' : ''
                    }`}
                  >
                    {item.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Filtros e Busca */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={driveSearch}
                  onChange={(e) => {
                    setDriveSearch(e.target.value);
                    loadDriveFiles(currentFolderId || driveRootFolderId || undefined, e.target.value, driveFilter);
                  }}
                  placeholder="Buscar arquivos por nome no Drive..."
                  className="w-full pl-9 pr-3.5 py-2 bg-[#1F2937] border border-[#374151] rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'document', label: 'Estudos / Docs' },
                  { id: 'image', label: 'Fotos' },
                  { id: 'video', label: 'Vídeos' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setDriveFilter(f.id as any);
                      loadDriveFiles(currentFolderId || driveRootFolderId || undefined, driveSearch, f.id);
                    }}
                    className={`px-2.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
                      driveFilter === f.id
                        ? 'bg-amber-600 text-white'
                        : 'bg-[#1F2937] text-[#9CA3AF] hover:text-white border border-[#374151]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Arquivos do Drive */}
            {isLoadingDriveFiles ? (
              <div className="py-12 text-center text-xs text-[#9CA3AF] flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                <span>Carregando arquivos do Google Drive...</span>
              </div>
            ) : driveFiles.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#9CA3AF] bg-[#1F2937]/30 rounded-xl border border-dashed border-[#374151] space-y-2">
                <Folder className="w-8 h-8 mx-auto text-[#4B5563]" />
                <p className="font-medium text-white">Nenhum arquivo encontrado nesta pasta do Google Drive.</p>
                <p className="text-[11px]">
                  Envie arquivos usando o botão "+ Upload para Drive" ou compartilhe arquivos nesta pasta no Google Drive.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {driveFiles.map((file) => {
                  const isFolder = file.isFolder;
                  const isImage = file.mimeType.startsWith('image/');
                  const isVideo = file.mimeType.startsWith('video/');
                  const isDoc = file.mimeType.includes('document') || file.mimeType.includes('text') || file.mimeType.includes('pdf');

                  return (
                    <div
                      key={file.id}
                      className="p-3 bg-[#1F2937]/50 hover:bg-[#1F2937] border border-[#374151] rounded-xl flex items-center justify-between gap-3 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="shrink-0">
                          {isFolder ? (
                            <Folder className="w-5 h-5 text-amber-400" />
                          ) : isImage ? (
                            <ImageIcon className="w-5 h-5 text-emerald-400" />
                          ) : isVideo ? (
                            <VideoIcon className="w-5 h-5 text-rose-400" />
                          ) : (
                            <FileText className="w-5 h-5 text-blue-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          {isFolder ? (
                            <button
                              onClick={() => handleOpenFolder(file)}
                              className="font-bold text-white text-xs hover:text-amber-400 transition cursor-pointer truncate text-left block w-full"
                            >
                              {file.name}
                            </button>
                          ) : (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-white text-xs hover:text-amber-400 transition truncate block"
                            >
                              {file.name}
                            </a>
                          )}

                          <div className="flex items-center gap-2 text-[10px] text-[#9CA3AF] mt-0.5">
                            {file.size ? (
                              <span>{(file.size / 1024).toFixed(0)} KB</span>
                            ) : isFolder ? (
                              <span>Pasta</span>
                            ) : (
                              <span>Google Doc</span>
                            )}
                            {file.modifiedTime && (
                              <>
                                <span>•</span>
                                <span>{new Date(file.modifiedTime).toLocaleDateString('pt-BR')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isFolder ? (
                          <button
                            onClick={() => handleOpenFolder(file)}
                            className="px-3 py-1.5 bg-[#374151] hover:bg-[#4B5563] text-white text-xs font-medium rounded-lg transition cursor-pointer flex items-center gap-1"
                          >
                            <span>Abrir</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <>
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-[#9CA3AF] hover:text-white transition rounded-lg hover:bg-[#374151]"
                              title="Visualizar no Drive"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>

                            <button
                              onClick={() => handleOpenImportModal(file)}
                              className="px-3 py-1.5 bg-[#0077C8] hover:bg-[#0060A0] text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow"
                              title="Importar este arquivo para a plataforma Teleios"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Importar</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── MODAL DE IMPORTAÇÃO DO DRIVE PARA A PLATAFORMA ─────────────── */}
          {importModalFile && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#111827] border border-[#374151] rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-[#374151] pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#0077C8]" />
                    <h3 className="font-bold text-white text-base">Importar do Google Drive</h3>
                  </div>
                  <button
                    onClick={() => setImportModalFile(null)}
                    className="text-[#9CA3AF] hover:text-white p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 bg-[#1F2937]/60 rounded-xl border border-[#374151] text-xs space-y-1">
                  <span className="text-[#9CA3AF] block">Arquivo selecionado:</span>
                  <p className="font-bold text-white truncate">{importModalFile.name}</p>
                  <p className="text-[#9CA3AF] text-[11px] font-mono">{importModalFile.mimeType}</p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[#9CA3AF] font-bold uppercase mb-1">
                      Título na Plataforma Teleios:
                    </label>
                    <input
                      type="text"
                      value={importTitle}
                      onChange={(e) => setImportTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-xl text-white focus:outline-none focus:border-[#0077C8]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#9CA3AF] font-bold uppercase mb-1">
                      Categoria de Destino:
                    </label>
                    <select
                      value={importCategory}
                      onChange={(e) => setImportCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#1F2937] border border-[#374151] rounded-xl text-white focus:outline-none focus:border-[#0077C8]"
                    >
                      <option value="ESTUDO">Estudo Bíblico / Devocional (com síntese Gemini IA)</option>
                      <option value="GALERIA">Galeria de Fotos</option>
                      <option value="VIDEO">Vídeo &amp; Pregação</option>
                      <option value="APOIO">Documento de Apoio / Áudio</option>
                    </select>
                  </div>

                  {/* Disparo Automático para WhatsApp */}
                  {importCategory === 'ESTUDO' && (
                    <div className="p-3 bg-[#1F2937] border border-[#374151] rounded-xl space-y-2.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={importAutoDispatch}
                          onChange={(e) => setImportAutoDispatch(e.target.checked)}
                          className="rounded border-[#374151] text-[#0077C8] focus:ring-[#0077C8]"
                        />
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <MessageCircle className="w-4 h-4 text-emerald-400" />
                          <span>Disparar para o WhatsApp após importar</span>
                        </span>
                      </label>

                      {importAutoDispatch && (
                        <div className="space-y-2 pt-1 border-t border-[#374151]/60">
                          <div>
                            <label className="block text-[11px] text-[#9CA3AF] mb-1">Canal de Destino:</label>
                            <select
                              value={importChannelId}
                              onChange={(e) => setImportChannelId(e.target.value)}
                              className="w-full px-3 py-1.5 bg-[#111827] border border-[#374151] rounded-lg text-xs text-white"
                            >
                              <option value="">Canal Principal Padrão ({globalWaChannel?.name || 'Geral'})</option>
                              {waChannels.map((ch) => (
                                <option key={ch.id} value={ch.id}>
                                  {ch.name} ({ch.type})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] text-[#9CA3AF] mb-1">Ou informe um número individual (com DDD):</label>
                            <input
                              type="tel"
                              value={importPhone}
                              onChange={(e) => setImportPhone(e.target.value)}
                              placeholder="5511999998888"
                              className="w-full px-3 py-1.5 bg-[#111827] border border-[#374151] rounded-lg text-xs text-white font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {importFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      importFeedback.success
                        ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                    }`}
                  >
                    {importFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{importFeedback.text}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#374151]">
                  <button
                    type="button"
                    onClick={() => setImportModalFile(null)}
                    className="px-4 py-2 bg-[#1F2937] hover:bg-[#374151] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isImporting}
                    className="px-5 py-2 bg-[#0077C8] hover:bg-[#0060A0] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processando com IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Confirmar e Importar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── MODAL DE UPLOAD DIRETO PARA O DRIVE ─────────────────────────── */}
          {showUploadModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#111827] border border-[#374151] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#374151] pb-3">
                  <div className="flex items-center gap-2">
                    <UploadCloud className="w-5 h-5 text-amber-400" />
                    <h3 className="font-bold text-white text-base">Fazer Upload para o Drive</h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                    }}
                    className="text-[#9CA3AF] hover:text-white p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[#9CA3AF] font-bold uppercase mb-1">
                      Selecione o arquivo do computador:
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[#9CA3AF] file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#1F2937] file:text-white hover:file:bg-[#374151] cursor-pointer"
                    />
                  </div>

                  {uploadFile && (
                    <div className="p-3 bg-[#1F2937] rounded-xl text-xs space-y-1 border border-[#374151]">
                      <span className="text-[#9CA3AF] block">Pronto para envio:</span>
                      <p className="font-bold text-white truncate">{uploadFile.name}</p>
                      <p className="text-[#9CA3AF]">{(uploadFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                  )}
                </div>

                {uploadFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      uploadFeedback.success
                        ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                    }`}
                  >
                    {uploadFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{uploadFeedback.text}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#374151]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                    }}
                    className="px-4 py-2 bg-[#1F2937] hover:bg-[#374151] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteUploadToDrive}
                    disabled={!uploadFile || isUploadingDrive}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    {isUploadingDrive ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Enviando para o Drive...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        <span>Enviar para o Drive</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Monitor de Backup Incremental */}
          <div className="bg-[#111827] border border-[#374151] rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-[#374151] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-950/60 border border-blue-800 text-blue-400 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white">Status do Backup Incremental</h3>
                  <p className="text-xs text-[#9CA3AF]">
                    Fila assíncrona organizada por pastas estruturadas (Conteúdos, Mídias e Snapshots).
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
                <button
                  onClick={handleDownloadBackup}
                  disabled={isDownloading}
                  className="px-3.5 py-2.5 bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowDownToLine className={`w-4 h-4 ${isDownloading ? 'animate-pulse' : ''}`} />
                  <span>Baixar backup.json</span>
                </button>
                <button
                  onClick={handleRunBackup}
                  disabled={isDoingBackup}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
                >
                  <RefreshCw className={`w-4 h-4 ${isDoingBackup ? 'animate-spin' : ''}`} />
                  <span>{isDoingBackup ? 'Sincronizando...' : 'Fazer Backup Agora'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs">
              <div className="bg-[#1F2937]/50 border border-[#374151]/50 rounded-xl p-3.5 sm:p-4 space-y-1">
                <span className="text-[#9CA3AF] block text-[11px]">Último Backup:</span>
                <span className="text-white font-mono font-bold text-sm truncate block">
                  {backupStatus?.lastBackupAt
                    ? new Date(backupStatus.lastBackupAt).toLocaleString('pt-BR')
                    : 'Nenhum backup recente'}
                </span>
              </div>

              <div className="bg-[#1F2937]/50 border border-[#374151]/50 rounded-xl p-3.5 sm:p-4 space-y-1">
                <span className="text-[#9CA3AF] block text-[11px]">Fila Incremental:</span>
                <span className={`font-mono font-bold text-sm ${backupStatus?.pendingCount ? 'text-[#F5A800]' : 'text-emerald-400'}`}>
                  {backupStatus?.pendingCount !== undefined ? `${backupStatus.pendingCount} na fila` : '0 na fila'}
                </span>
              </div>

              <div className="bg-[#1F2937]/50 border border-[#374151]/50 rounded-xl p-3.5 sm:p-4 space-y-1">
                <span className="text-[#9CA3AF] block text-[11px]">Total Sincronizado:</span>
                <span className="text-emerald-400 font-mono font-bold text-sm">
                  {backupStatus?.syncedCount ? `${backupStatus.syncedCount} itens` : backupStatus?.totalItems ? `${backupStatus.totalItems} itens` : '0 itens'}
                </span>
              </div>

              <div className="bg-[#1F2937]/50 border border-[#374151]/50 rounded-xl p-3.5 sm:p-4 space-y-1">
                <span className="text-[#9CA3AF] block text-[11px]">Estrutura de Pastas:</span>
                <span className="text-blue-400 font-mono text-[11px] truncate block" title="Teleios_Backup/{Conteudos,Midias,Database}">
                  Teleios_Backup/
                </span>
              </div>
            </div>

            {backupFeedback && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  backupFeedback.success
                    ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                }`}
              >
                {backupFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{backupFeedback.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ABA 3: GOOGLE GEMINI AI ────────────────────────────────────────── */}
      {activeTab === 'gemini' && (
        <div className="bg-[#111827] border border-[#374151] rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#374151] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-950/60 border border-blue-800 text-blue-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Google Gemini AI</h3>
                <p className="text-xs text-[#9CA3AF]">Síntese & Análise de Conteúdo</p>
              </div>
            </div>

            <span
              className={`px-3 py-1 text-[11px] font-bold rounded-full flex items-center gap-1.5 self-start sm:self-auto ${
                geminiStatus?.configured
                  ? 'bg-blue-950 border border-blue-800 text-blue-300'
                  : 'bg-amber-950 border border-amber-800 text-amber-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${geminiStatus?.configured ? 'bg-blue-400' : 'bg-amber-400'}`} />
              <span>{geminiStatus?.configured ? 'API Configurada' : 'Não Configurada'}</span>
            </span>
          </div>

          <div className="space-y-3.5 sm:space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                Chave de API do Google Gemini (Armazenada seguramente no Worker):
              </label>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder={geminiStatus?.apiKeyMasked || 'Informe a nova API Key (AIzaSy...)'}
                  className="w-full pr-10 pl-3.5 py-2.5 bg-[#1F2937] border border-[#374151] rounded-xl text-xs text-white focus:outline-none focus:border-[#0077C8] font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white cursor-pointer"
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {geminiStatus?.apiKeyMasked && (
                <p className="text-[11px] text-[#9CA3AF] mt-1 truncate">
                  Chave ativa atual: <strong className="text-white font-mono">{geminiStatus.apiKeyMasked}</strong>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                Modelo de IA:
              </label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#1F2937] border border-[#374151] rounded-xl text-xs text-white focus:outline-none focus:border-[#0077C8] cursor-pointer"
              >
                <option value="gemini-1.5-flash">gemini-1.5-flash (Mais rápido e econômico)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (Mais detalhado para reflexões bíblicas profundas)</option>
              </select>
            </div>
          </div>

          {geminiFeedback && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                geminiFeedback.success
                  ? 'bg-blue-950/80 border border-blue-800 text-blue-300'
                  : 'bg-rose-950/80 border border-rose-800 text-rose-300'
              }`}
            >
              {geminiFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{geminiFeedback.message}</span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestGemini}
              disabled={isTestingGemini}
              className="px-4 py-2.5 bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${isTestingGemini ? 'animate-spin' : ''}`} />
              <span>{isTestingGemini ? 'Testando API...' : 'Testar Conexão Gemini'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveGemini}
              disabled={isSavingGemini}
              className="px-5 py-2.5 bg-[#0077C8] hover:bg-[#005F9E] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingGemini ? 'Salvando...' : 'Salvar Chave'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Dica de Segurança */}
      <div className="bg-[#1F2937]/40 border border-[#374151] rounded-xl p-4 flex items-center gap-3 text-xs text-[#9CA3AF]">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <span>
          As configurações são salvas de forma segura no Cloudflare Worker KV e aplicadas imediatamente na Landing Page e no agendador.
        </span>
      </div>
    </div>
  );
};
