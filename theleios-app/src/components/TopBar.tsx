import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '@/lib/auth';

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  const navigate = useNavigate();
  const user = getCurrentUser();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
      <h1 className="text-lg font-semibold text-[var(--color-text)] truncate">{title}</h1>
      <button
        onClick={() => navigate('/perfil')}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-surface-alt)] hover:bg-[var(--color-border)] transition-colors"
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
    </header>
  );
}
