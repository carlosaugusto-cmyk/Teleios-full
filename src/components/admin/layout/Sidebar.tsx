import React from 'react';
import {
  Globe,
  Layers,
  Sparkles,
  HardDrive,
  Video,
  FileText,
  Activity,
  Settings,
  MessageCircle,
  Code,
  ExternalLink,
  ShieldCheck,
  LogOut,
  Crown,
  User as UserIcon,
  Wifi,
  WifiOff,
  Database,
  Server,
  Cloud,
} from 'lucide-react';
import { TeleiosLogo } from '../../common/TeleiosLogo.tsx';
import { SystemStatus, UserRole } from '../../../types/index.ts';
import { hasPermission } from '../../../services/security.service.ts';

// Dark mode palette (inline styles to guarantee dark mode regardless of Tailwind config)
const D = {
  bg: '#111827',        // sidebar background
  bgHover: '#1F2937',   // hover/active bg
  bgActive: '#0F2B5C',  // active nav item bg
  border: '#374151',    // borders
  text: '#F9FAFB',      // primary text
  textSec: '#E5E7EB',   // secondary text
  textMuted: '#9CA3AF', // muted/label text
  gold: '#F5A800',
  blue: '#0077C8',
  green: '#10B981',
  red: '#EF4444',
};

const ROLE_CONFIG: Record<UserRole, { label: string; icon: any; color: string }> = {
  superadmin: { label: 'Superadmin', icon: Crown, color: D.gold },
  admin: { label: 'Admin', icon: ShieldCheck, color: D.blue },
  operador: { label: 'Operador', icon: UserIcon, color: D.green },
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  systemStatus,
  isOpenMobile,
  onCloseMobile,
  onOpenPublicSite,
  userPermissions,
  userDisplayName,
  userRole,
  onLogout,
}) => {
  const canAccess = (module: string) => hasPermission(userPermissions, module);

  const navSections = [
    {
      group: 'Gerenciar',
      items: [
        { id: 'ingest', label: 'Novo Arquivo', icon: Layers, permission: 'ingest' },
        { id: 'estudos', label: 'Estudos', icon: Sparkles, permission: 'estudos' },
        { id: 'videos', label: 'Vídeos', icon: Video, permission: 'videos' },
        { id: 'galeria', label: 'Galeria', icon: HardDrive, permission: 'galeria' },
        { id: 'projetos', label: 'Projetos', icon: FileText, permission: 'projetos' },
        { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, permission: 'whatsapp' },
      ].filter((item) => canAccess(item.permission)),
    },
    {
      group: 'Sistema',
      items: [
        { id: 'queues', label: 'Automações', icon: Activity, permission: 'queues' },
        { id: 'config', label: 'Configurações', icon: Settings, permission: 'config' },
      ].filter((item) => canAccess(item.permission)),
    },
  ].filter((section) => section.items.length > 0);

  const handleItemClick = (id: string) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const roleConfig = ROLE_CONFIG[userRole] || ROLE_CONFIG.operador;
  const RoleIcon = roleConfig.icon;

  const driveStatus = systemStatus?.drive?.status || 'unknown';
  const whastmeoStatus = systemStatus?.whastmeo?.status || 'unknown';
  const cronStatus = systemStatus?.scheduler?.active ? 'healthy' : 'unknown';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': case 'online': case 'healthy': return D.green;
      case 'connecting': case 'warning': return D.gold;
      case 'error': case 'offline': case 'unhealthy': return D.red;
      default: return D.textMuted;
    }
  };

  const getStatusIcon = (status: string) => {
    const color = getStatusColor(status);
    if (status === 'error' || status === 'offline' || status === 'unhealthy') {
      return <WifiOff className="w-3.5 h-3.5" style={{ color }} />;
    }
    return <Wifi className="w-3.5 h-3.5" style={{ color }} />;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 lg:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'
          }`}
        style={{
          width: '18rem',  /* 288px */
          backgroundColor: D.bg,
          borderRight: `1px solid ${D.border}`,
        }}
        role="navigation"
        aria-label="Menu principal de administração"
      >


        {/* Navigation */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          role="list"
        >
          {navSections.map((section, idx) => (
            <div key={idx} role="listitem">
              <span
                className="block text-xs font-bold uppercase tracking-widest px-2 mb-2"
                style={{ color: D.textMuted }}
              >
                {section.group}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className="w-full text-left flex items-center justify-between rounded-lg cursor-pointer transition-colors"
                      style={{
                        padding: '0.75rem 0.875rem',
                        backgroundColor: isActive ? D.bgActive : 'transparent',
                        color: isActive ? D.text : D.textSec,
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '0.9375rem',
                        minHeight: '52px',
                        border: 'none',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) e.currentTarget.style.backgroundColor = D.bgHover;
                      }}
                      onMouseLeave={e => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={item.label}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Icon
                          className="w-5 h-5 flex-shrink-0"
                          style={{ color: isActive ? D.gold : D.textMuted }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer: Status + Logout */}
        <div
          style={{
            padding: '1rem',
            borderTop: `1px solid ${D.border}`,
            backgroundColor: '#0D1117',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >


          {/* Logout button */}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 rounded-lg cursor-pointer transition-colors font-semibold"
            style={{
              padding: '0.875rem 1rem',
              backgroundColor: '#1F2937',
              border: `1px solid ${D.border}`,
              color: D.textSec,
              fontSize: '0.9375rem',
              minHeight: '52px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)';
              e.currentTarget.style.color = D.red;
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#1F2937';
              e.currentTarget.style.color = D.textSec;
              e.currentTarget.style.borderColor = D.border;
            }}
            aria-label="Encerrar sessão"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>
    </>
  );
};

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  systemStatus: SystemStatus | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenPublicSite: () => void;
  userPermissions: string[];
  userDisplayName: string;
  userRole: UserRole;
  onLogout: () => void;
}
