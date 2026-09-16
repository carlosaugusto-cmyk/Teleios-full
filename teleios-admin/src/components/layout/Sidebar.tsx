import React from 'react';
import {
  Layers,
  Sparkles,
  HardDrive,
  Video,
  FileText,
  MessageCircle,
  Calendar,
  Zap,
  ShieldCheck,
  LogOut,
  Crown,
  User as UserIcon,
  Wifi,
  WifiOff,
  UserCheck,
  Users,
  DollarSign,
  X,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { SystemStatus, UserRole } from '../../types/index.ts';
import { hasPermission } from '../../services/security.service.ts';
import { PwaInstallButton } from '../common/PwaInstallButton.tsx';

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
        { id: 'estudos_devocionais', label: 'Estudos & Devocionais', icon: BookOpen, permission: 'estudos' },
        { id: 'usuarios', label: 'Usuários', icon: Users, permission: 'estudos' },
        { id: 'financeiro', label: 'Controle Financeiro', icon: DollarSign, permission: 'estudos' },
      ].filter((item) => canAccess(item.permission) || (item.id === 'estudos_devocionais' && canAccess('devocionais')) || ((item.id === 'usuarios' || item.id === 'financeiro') && (canAccess('estudos') || canAccess('*')))),
    },
    {
      group: 'Sistema',
      items: [
        { id: 'integracoes', label: 'Integrações', icon: Zap, permission: 'integracoes' },
      ].filter((item) => canAccess(item.permission)),
    },
  ].filter((section) => section.items.length > 0);

  const handleItemClick = (id: string) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const roleConfig = ROLE_CONFIG[userRole] || ROLE_CONFIG.operador;

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
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 w-72 max-w-[85vw] ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundColor: D.bg,
          borderRight: `1px solid ${D.border}`,
        }}
        role="navigation"
        aria-label="Menu principal de administração"
      >
        {/* Top Header: Logo + User Profile + Close Button (Mobile) */}
        <div
          className="px-4 py-3.5 border-b flex items-center justify-between gap-2"
          style={{ borderColor: D.border, backgroundColor: '#0D1117' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: D.bgActive, color: D.gold }}
            >
              <Crown className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="block font-serif font-bold text-sm text-white tracking-wide truncate">
                Teleios Admin
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF] truncate">
                <span className="truncate max-w-[110px]">{userDisplayName}</span>
                <span>•</span>
                <span className="font-semibold text-[#F5A800]">{roleConfig.label}</span>
              </div>
            </div>
          </div>

          {/* Close button - visible on mobile only */}
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg lg:hidden transition-colors cursor-pointer text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] shrink-0"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          role="list"
        >
          {navSections.map((section, idx) => (
            <div key={idx} role="listitem">
              <span
                className="block text-[11px] font-bold uppercase tracking-wider px-2 mb-1.5"
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
                        padding: '0.625rem 0.75rem',
                        backgroundColor: isActive ? D.bgActive : 'transparent',
                        color: isActive ? D.text : D.textSec,
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '0.875rem',
                        minHeight: '44px',
                        border: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = D.bgHover;
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={item.label}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Icon
                          className="w-4.5 h-4.5 flex-shrink-0"
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

        {/* Footer: PWA Install + Public Site Link + Logout */}
        <div
          style={{
            padding: '0.875rem 1rem',
            borderTop: `1px solid ${D.border}`,
            backgroundColor: '#0D1117',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {/* Instalar PWA */}
          <PwaInstallButton variant="sidebar" />

          {/* Ir para o site público */}
          <button
            onClick={() => {
              onCloseMobile();
              onOpenPublicSite();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-lg cursor-pointer transition-colors text-xs font-semibold text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] py-2 px-3 border border-[#374151]/60"
            aria-label="Abrir site público"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Ver Site Público</span>
          </button>

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 rounded-lg cursor-pointer transition-colors font-semibold"
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: '#1F2937',
              border: `1px solid ${D.border}`,
              color: D.textSec,
              fontSize: '0.875rem',
              minHeight: '42px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)';
              e.currentTarget.style.color = D.red;
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
            }}
            onMouseLeave={(e) => {
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