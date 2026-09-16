import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, BookOpen, Bell } from 'lucide-react';

import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import LoginModal from '@/components/LoginModal';
import DocumentViewer from '@/components/DocumentViewer';
import DevocionaisPage from '@/pages/DevocionaisPage';
import EstudosPage from '@/pages/EstudosPage';
import PerfilPage from '@/pages/PerfilPage';

import { fetchEstudo, fetchEstudos, type Study } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';
import { getState, setState, markAsRead, wasLoginPromptShown } from '@/lib/storage';
import { checkNewContentAndNotify } from '@/lib/notifications';

// ─── Página de detalhe do conteúdo (tela cheia) ─────────────────────────────

function ConteudoPage() {
  const navigate = useNavigate();
  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'texto' | 'documento'>('texto');

  const id = useLocation().pathname.split('/conteudo/')[1] || '';

  useEffect(() => {
    if (!id) return;
    fetchEstudo(id)
      .then((data) => {
        setStudy(data);
        if (data) {
          markAsRead(data.id);
          // Se tiver documento e o texto for vazio ou resumo de anexo, abre o documento por padrão
          if (data.documentUrl && (!data.content || data.content.startsWith('Documento'))) {
            setActiveTab('documento');
          }
        }
      })
      .catch(() => setStudy(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-dvh bg-[var(--color-bg)]">
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-[var(--color-surface-alt)] cursor-pointer" aria-label="Voltar">
            <ArrowLeft size={20} className="text-[var(--color-text)]" />
          </button>
          <span className="text-lg font-semibold text-[var(--color-text)]">Carregando...</span>
        </header>
        <div className="flex items-center justify-center flex-1 py-16">
          <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="flex flex-col min-h-dvh bg-[var(--color-bg)]">
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-[var(--color-surface-alt)] cursor-pointer" aria-label="Voltar">
            <ArrowLeft size={20} className="text-[var(--color-text)]" />
          </button>
          <span className="text-lg font-semibold text-[var(--color-text)]">Não encontrado</span>
        </header>
        <div className="flex items-center justify-center flex-1 py-16">
          <p className="text-sm text-[var(--color-text-muted)]">Conteúdo não encontrado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--color-bg)]">
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-[var(--color-surface-alt)] cursor-pointer" aria-label="Voltar">
          <ArrowLeft size={20} className="text-[var(--color-text)]" />
        </button>
        <span className="text-lg font-semibold text-[var(--color-text)] truncate">{study.type}</span>
      </header>

      {/* Abas Alternadoras quando houver documento anexado */}
      {study.documentUrl && (
        <div className="flex border-b border-[var(--color-border)] px-4 bg-[var(--color-surface)]">
          <button
            onClick={() => setActiveTab('texto')}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs border-b-2 transition-colors cursor-pointer ${
              activeTab === 'texto'
                ? 'border-[var(--color-primary)] text-[var(--color-primary-light)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            <BookOpen size={14} />
            <span>Reflexão / Texto</span>
          </button>
          <button
            onClick={() => setActiveTab('documento')}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs border-b-2 transition-colors cursor-pointer ${
              activeTab === 'documento'
                ? 'border-[var(--color-primary)] text-[var(--color-primary-light)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            <FileText size={14} />
            <span>Documento ({(study.documentType || 'DOC').toUpperCase()})</span>
          </button>
        </div>
      )}

      <article className={`flex-1 ${study.documentUrl && activeTab === 'documento' ? 'p-0 w-full' : 'px-4 py-5'}`}>
        {(!study.documentUrl || activeTab === 'texto') && (
          <>
            <h1 className="text-xl font-bold text-[var(--color-text)] mb-3">{study.title}</h1>
            {study.topic && (
              <p className="text-xs text-[var(--color-primary-light)] mb-4 uppercase tracking-wider">{study.topic}</p>
            )}
          </>
        )}

        {study.documentUrl && activeTab === 'documento' ? (
          <DocumentViewer
            documentUrl={study.documentUrl}
            documentName={study.documentName || study.title}
            documentType={study.documentType}
            documentSize={study.documentSize}
          />
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
              {study.content || study.rawContent || study.summary || 'Sem conteúdo disponível.'}
            </div>

            {study.documentUrl && (
              <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setActiveTab('documento')}
                  className="w-full flex items-center justify-between p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)]/50 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/20 text-[var(--color-primary-light)] flex items-center justify-center font-bold text-xs uppercase">
                      {(study.documentType || 'DOC').toUpperCase()}
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-semibold text-white group-hover:text-[var(--color-primary-light)] transition-colors">
                        {study.documentName || 'Documento Anexo'}
                      </span>
                      <span className="text-xs text-gray-400">Clique para abrir o visor de documento</span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[var(--color-primary-light)] px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/10">
                    Abrir Visor
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </article>
    </div>
  );
}

// ─── Títulos por rota ─────────────────────────────────────────────────────────

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Devocionais';
  if (pathname === '/estudos') return 'Estude a Bíblia';
  if (pathname === '/perfil') return 'Perfil';
  return 'Theleios';
}

// ─── App principal ───────────────────────────────────────────────────────────

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const contentOpenCount = useRef(0);

  // Restaurar última página ao carregar
  useEffect(() => {
    const state = getState();
    const pathMap = { devocionais: '/', estudos: '/estudos', perfil: '/perfil' };
    const targetPath = pathMap[state.lastPage] || '/';
    if (location.pathname === '/' && targetPath !== '/') {
      navigate(targetPath, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Gatilho do popup: ao abrir 2º conteúdo sem estar logado
  const handleContentOpen = useCallback(() => {
    if (isLoggedIn()) return;
    contentOpenCount.current += 1;
    if (contentOpenCount.current >= 2 && !wasLoginPromptShown()) {
      setShowLoginModal(true);
    }
  }, []);

  // Detectar navegação para /conteudo/* para incrementar contador
  useEffect(() => {
    if (location.pathname.startsWith('/conteudo/')) {
      handleContentOpen();
    }
  }, [location.pathname, handleContentOpen]);

  const isConteudoPage = location.pathname.startsWith('/conteudo/');
  const title = getPageTitle(location.pathname);

  // Atualizar lastPage no state
  useEffect(() => {
    if (location.pathname === '/') setState({ lastPage: 'devocionais' });
    else if (location.pathname === '/estudos') setState({ lastPage: 'estudos' });
    else if (location.pathname === '/perfil') setState({ lastPage: 'perfil' });
  }, [location.pathname]);

  const [newContentBanner, setNewContentBanner] = useState<Study | null>(null);

  // Verificação periódica de novos devocionais/estudos para notificações
  useEffect(() => {
    const runCheck = async () => {
      try {
        const studies = await fetchEstudos();
        checkNewContentAndNotify(studies, (newStudy) => {
          setNewContentBanner(newStudy);
        });
      } catch {}
    };

    runCheck();
    const interval = setInterval(runCheck, 45000); // Verifica a cada 45s
    window.addEventListener('focus', runCheck);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', runCheck);
    };
  }, []);

  // Conteúdo em tela cheia — sem TopBar e BottomNav
  if (isConteudoPage) {
    return (
      <>
        <ConteudoPage />
        <LoginModal
          open={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => setShowLoginModal(false)}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--color-bg)]">
      <TopBar title={title} />

      {/* Banner de Notificação de Novo Conteúdo */}
      {newContentBanner && (
        <div
          onClick={() => {
            const studyId = newContentBanner.id;
            setNewContentBanner(null);
            navigate(`/conteudo/${studyId}`);
          }}
          className="mx-4 mt-3 p-3.5 bg-gradient-to-r from-blue-950/90 via-indigo-950/90 to-blue-950/90 border border-blue-500/50 rounded-2xl shadow-xl backdrop-blur-md cursor-pointer flex items-center justify-between gap-3 animate-fade-in"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
              <Bell size={20} className="animate-bounce" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                Novo {newContentBanner.type || 'Devocional'} Publicado!
              </span>
              <p className="text-xs font-bold text-white truncate">{newContentBanner.title}</p>
              <p className="text-[10px] text-blue-200/70">Toque aqui para ler agora</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setNewContentBanner(null);
            }}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 shrink-0"
            aria-label="Fechar aviso"
          >
            ✕
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<DevocionaisPage />} />
          <Route path="/estudos" element={<EstudosPage />} />
          <Route path="/perfil" element={<PerfilPage />} />
          <Route path="/conteudo/:id" element={<ConteudoPage />} />
        </Routes>
      </main>
      <BottomNav />
      <LoginModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={() => setShowLoginModal(false)}
      />
    </div>
  );
}
