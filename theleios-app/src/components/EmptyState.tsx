import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  message: string;
  icon?: typeof Inbox;
}

export default function EmptyState({ message, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <Icon size={48} className="text-[var(--color-text-muted)] opacity-40" />
      <p className="text-sm text-[var(--color-text-muted)]">{message}</p>
    </div>
  );
}
