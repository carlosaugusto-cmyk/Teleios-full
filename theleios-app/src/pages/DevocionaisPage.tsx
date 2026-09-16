import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Check, Circle, ChevronRight, FileText } from 'lucide-react';
import { fetchEstudos, type Study } from '@/lib/api';
import { isRead, setState } from '@/lib/storage';
import EmptyState from '@/components/EmptyState';

type ReadStatus = 'unread' | 'read';

function getReadStatus(id: string): ReadStatus {
  return isRead(id) ? 'read' : 'unread';
}

export default function DevocionaisPage() {
  const navigate = useNavigate();
  const [devocionais, setDevocionais] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEstudos()
      .then((all) => {
        const filtered = all.filter((s) => s.type === 'Devocional');
        setDevocionais(filtered);
      })
      .catch(() => setDevocionais([]))
      .finally(() => setLoading(false));
  }, []);

  const handleOpen = (item: Study) => {
    setState({ lastDevocionalId: item.id });
    navigate(`/conteudo/${item.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (devocionais.length === 0) {
    return <EmptyState message="Nenhum devocional disponível no momento" icon={BookOpen} />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
      {devocionais.map((item) => {
        const status = getReadStatus(item.id);
        const cover = item.thumbnailUrl
          || (item.generatedImgUrl?.includes('/api/media/') ? `${item.generatedImgUrl}?variant=thumbnail` : item.generatedImgUrl)
          || item.aiImageUrl
          || item.mediaFile?.driveWebViewLink;
        const preview = item.summary || item.content || item.rawContent || '';

        return (
          <button
            key={item.id}
            onClick={() => handleOpen(item)}
            className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden hover:border-[var(--color-primary-light)]/50 transition-all text-left flex flex-col active:scale-[0.99] cursor-pointer shadow-sm"
          >
            {/* Imagem de Capa do Card */}
            {cover ? (
              <div className="h-44 w-full overflow-hidden bg-black/40 relative">
                <img
                  src={cover}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 right-3">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full backdrop-blur-md ${
                      status === 'read'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                        : 'bg-black/60 text-gray-300 border border-white/10'
                    }`}
                  >
                    {status === 'read' ? <Check size={12} className="text-emerald-400" /> : <Circle size={10} />}
                    {status === 'read' ? 'Lido' : 'Não lido'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-28 w-full bg-gradient-to-br from-purple-950/40 via-[var(--color-surface-alt)] to-[var(--color-surface)] border-b border-[var(--color-border)] p-4 flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/20 text-[var(--color-primary-light)] flex items-center justify-center">
                  <BookOpen size={20} />
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full ${
                    status === 'read'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                  }`}
                >
                  {status === 'read' ? <Check size={12} className="text-emerald-400" /> : <Circle size={10} />}
                  {status === 'read' ? 'Lido' : 'Não lido'}
                </span>
              </div>
            )}

            {/* Conteúdo do Card */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  {item.topic && (
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary-light)]">
                      {item.topic}
                    </span>
                  )}
                  {item.documentUrl && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-700/60">
                      <FileText size={10} />
                      {(item.documentType || 'DOC').toUpperCase()}
                    </span>
                  )}
                </div>
                <h2 className="text-base font-semibold text-[var(--color-text)] line-clamp-2 mb-2 leading-snug">
                  {item.title}
                </h2>
                {preview && (
                  <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
                    {preview}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--color-border)]/60 text-xs text-[var(--color-primary-light)] font-medium">
                <span>Ler devocional</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
