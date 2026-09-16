import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Filter, ChevronRight, FileText } from 'lucide-react';
import { fetchEstudos, type Study } from '@/lib/api';
import { setState } from '@/lib/storage';
import { BIBLE_BOOKS, extractBibleReference } from '@/lib/bibleExtractor';
import EmptyState from '@/components/EmptyState';

export default function EstudosPage() {
  const navigate = useNavigate();
  const [estudos, setEstudos] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<string>('TODOS');

  // Carrega todos os estudos imediatamente ao abrir
  useEffect(() => {
    fetchEstudos()
      .then((all) => setEstudos(all.filter((s) => s.type === 'Estudo')))
      .catch(() => setEstudos([]))
      .finally(() => setLoading(false));
  }, []);

  // Filtra os estudos pelo livro selecionado (ou todos)
  const filteredEstudos = useMemo(() => {
    if (selectedBook === 'TODOS') return estudos;

    return estudos.filter((s) => {
      // 1. Tenta extrair do título ou conteúdo
      const ref = extractBibleReference(`${s.title} ${s.rawContent || s.content || ''} ${s.topic || ''}`);
      if (ref && ref.book === selectedBook) return true;

      // 2. Tenta casamento de string no título ou topic
      const bookLower = selectedBook.toLowerCase();
      const titleLower = (s.title || '').toLowerCase();
      const topicLower = (s.topic || '').toLowerCase();
      return titleLower.includes(bookLower) || topicLower.includes(bookLower);
    });
  }, [estudos, selectedBook]);

  const handleOpenStudy = (study: Study) => {
    const ref = extractBibleReference(`${study.title} ${study.rawContent || ''} ${study.topic || ''}`);
    if (ref) {
      setState({ lastEstudoRef: { livro: ref.book, capitulo: ref.chapter } });
    }
    navigate(`/conteudo/${study.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Barra de Filtro de Livro no Topo */}
      <div className="flex items-center gap-2 p-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
        <Filter size={18} className="text-[var(--color-primary-light)] ml-2 shrink-0" />
        <select
          value={selectedBook}
          onChange={(e) => setSelectedBook(e.target.value)}
          className="w-full px-2 py-1.5 bg-transparent text-sm font-medium text-[var(--color-text)] focus:outline-none cursor-pointer appearance-none"
        >
          <option value="TODOS" className="bg-[var(--color-surface)] text-[var(--color-text)]">
            Todos os Livros da Bíblia ({estudos.length})
          </option>
          {BIBLE_BOOKS.map((b) => (
            <option key={b.name} value={b.name} className="bg-[var(--color-surface)] text-[var(--color-text)]">
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Lista de Estudos Existentes em Cards */}
      {filteredEstudos.length === 0 ? (
        <EmptyState
          message={
            selectedBook === 'TODOS'
              ? 'Nenhum estudo bíblico disponível no momento'
              : `Ainda não há estudo disponível para o livro de ${selectedBook}`
          }
          icon={GraduationCap}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredEstudos.map((study) => {
            const cover = study.thumbnailUrl
              || (study.generatedImgUrl?.includes('/api/media/') ? `${study.generatedImgUrl}?variant=thumbnail` : study.generatedImgUrl)
              || study.aiImageUrl
              || study.mediaFile?.driveWebViewLink;
            const ref = extractBibleReference(`${study.title} ${study.rawContent || ''} ${study.topic || ''}`);
            const bookLabel = ref ? `${ref.book} ${ref.chapter}` : (study.topic || 'Estudo');
            const preview = study.summary || study.content || study.rawContent || '';

            return (
              <button
                key={study.id}
                onClick={() => handleOpenStudy(study)}
                className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden hover:border-[var(--color-primary-light)]/50 transition-all text-left flex flex-col active:scale-[0.99] cursor-pointer shadow-sm"
              >
                {/* Capa do Estudo */}
                {cover ? (
                  <div className="h-44 w-full overflow-hidden bg-black/40 relative">
                    <img
                      src={cover}
                      alt={study.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-950/80 text-blue-300 border border-blue-700/60 backdrop-blur-md">
                        📖 {bookLabel}
                      </span>
                      {study.documentUrl && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 backdrop-blur-md">
                          <FileText size={10} />
                          {(study.documentType || 'DOC').toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-28 w-full bg-gradient-to-br from-blue-950/40 via-[var(--color-surface-alt)] to-[var(--color-surface)] border-b border-[var(--color-border)] p-4 flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <GraduationCap size={20} />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-950/80 text-blue-300 border border-blue-700/60">
                        📖 {bookLabel}
                      </span>
                      {study.documentUrl && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
                          <FileText size={10} />
                          {(study.documentType || 'DOC').toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Conteúdo do Card */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--color-text)] line-clamp-2 mb-2 leading-snug">
                      {study.title}
                    </h2>
                    {preview && (
                      <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
                        {preview}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--color-border)]/60 text-xs text-[var(--color-primary-light)] font-medium">
                    <span>Acessar estudo</span>
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
