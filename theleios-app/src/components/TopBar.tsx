import { useState, useEffect } from 'react';
import { User, Bell, BellRing, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '@/lib/auth';
import { isNotificationEnabled, isNotificationSupported, requestNotificationPermission } from '@/lib/notifications';

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  useEffect(() => {
    setNotifEnabled(isNotificationEnabled());
  }, []);

  const handleToggleNotifications = async () => {
    if (!isNotificationSupported()) {
      setShowToast('Notificações não são suportadas neste navegador.');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    if (notifEnabled) {
      setShowToast('Notificações de novos conteúdos já estão ativadas!');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    const granted = await requestNotificationPermission();
    setNotifEnabled(granted);
    if (granted) {
      setShowToast('✅ Notificações ativadas! Você será avisado de novos devocionais.');
    } else {
      setShowToast('Permissão de notificações não foi concedida.');
    }
    setTimeout(() => setShowToast(null), 3500);
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <h1 className="text-lg font-semibold text-[var(--color-text)] truncate">{title}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleNotifications}
            className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-colors cursor-pointer ${
              notifEnabled
                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-white'
            }`}
            title={notifEnabled ? 'Notificações ativadas' : 'Ativar notificações de novos conteúdos'}
            aria-label="Notificações"
          >
            {notifEnabled ? <BellRing size={18} /> : <Bell size={18} />}
            {notifEnabled && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[var(--color-surface)]" />
            )}
          </button>

          <button
            onClick={() => navigate('/perfil')}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-surface-alt)] hover:bg-[var(--color-border)] transition-colors cursor-pointer"
            aria-label="Perfil"
          >
            {user ? (
              <span className="text-sm font-bold text-[var(--color-primary-light)]">
                {user.name.charAt(0).toUpperCase()}
              </span>
            ) : (
              <User size={20} className="text-[var(--color-text-muted)]" />
            )}
          </button>
        </div>
      </header>

      {/* Feedback Toast */}
      {showToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#1F2937] border border-blue-500/50 text-white text-xs font-medium rounded-full shadow-2xl flex items-center gap-2 animate-fade-in">
          <span>{showToast}</span>
        </div>
      )}
    </>
  );
}
