import { BookOpen, GraduationCap, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setState } from '@/lib/storage';

interface NavItem {
  label: string;
  path: string;
  icon: typeof BookOpen;
  page: 'devocionais' | 'estudos' | 'perfil';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Devocionais', path: '/', icon: BookOpen, page: 'devocionais' },
  { label: 'Estudos', path: '/estudos', icon: GraduationCap, page: 'estudos' },
  { label: 'Perfil', path: '/perfil', icon: User, page: 'perfil' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNav = (item: NavItem) => {
    setState({ lastPage: item.page });
    navigate(item.path);
  };

  return (
    <nav className="sticky bottom-0 z-30 flex items-stretch justify-around bg-[var(--color-surface)] border-t border-[var(--color-border)]"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.path);
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => handleNav(item)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 px-4 min-h-[56px] min-w-[72px] transition-colors"
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
          >
            <Icon
              size={24}
              className={active ? 'text-[var(--color-primary-light)]' : 'text-[var(--color-text-muted)]'}
            />
            <span
              className={`text-[10px] font-medium ${active ? 'text-[var(--color-primary-light)]' : 'text-[var(--color-text-muted)]'}`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
