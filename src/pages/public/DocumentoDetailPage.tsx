import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ArrowLeft,
  Clock,
  Share2,
  FileText,
  Download,
  Check,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Music,
  Volume2,
  Video as VideoIcon,
  Play,
} from 'lucide-react';
import { Study, VideoMetadata } from '../../types/index.ts';
import {
  getStudyTitle,
  isStudyBinary,
  safeApiFetch,
} from '../../utils/contentSanitizer.ts';

export default function DocumentoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [study, setStudy] = useState<Study | null>(null);
  const [video, setVideo] = useState<VideoMetadata | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const loadDocumento = useCallback(async () => {
    if (!id) {
      setErrorMessage('Identificador do documento não fornecido.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStudy(null);
    setVideo(null);

    try {
      // 1. Tentar buscar como estudo/devocional direto
      const directStudy = await safeApiFetch<Study>(`/api/estudos/${id}`);
      if (directStudy.success && directStudy.data && directStudy.data.id) {
        setStudy(directStudy.data);
        setIsLoading(false);
        return;
      }

      // 2. Tentar buscar na lista de estudos (por ID ou slug)
      const listStudies = await safeApiFetch<Study[]>('/api/estudos');
      if (listStudies.success && Array.isArray(listStudies.data)) {
        const foundStudy = listStudies.data.find((item) => item.id === id || item.slug === id);
        if (foundStudy) {
          setStudy(foundStudy);
          setIsLoading(false);
          return;
        }
      }

      // 3. Tentar buscar como vídeo
      const listVideos = await safeApiFetch<VideoMetadata[]>('/api/videos');
      if (listVideos.success && Array.isArray(listVideos.data)) {
        const foundVideo = listVideos.data.find((item) => item.id === id || item.youtubeVideoId === id);
        if (foundVideo) {
          setVideo(foundVideo);
          setIsLoading(false);
          return;
        }
      }

      setErrorMessage('Conteúdo não encontrado. O documento pode ter sido movido ou excluído.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado ao buscar documento.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDocumento();
    window.scrollTo(0, 0);
  }, [loadDocumento]);

  const handleShare = () => {
    const title = study ? getStudyTitle(study) : video?.title || 'Conteúdo Teleios';
    const text = study?.summary || video?.description || 'Acesse este conteúdo na plataforma Teleios.';

    if (navigator.share) {
      navigator
        .share({
          title,
          text,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const isPdf = Boolean(
    study?.mediaFile?.mimeType === 'application/pdf' ||
    (study?.mediaFile?.originalName || '').toLowerCase().endsWith('.pdf') ||
    (study && isStudyBinary(study))
  );

  const isAudio = Boolean(
    study?.mediaFile?.mimeType?.startsWith('audio/') ||
    (study?.mediaFile?.originalName || '').toLowerCase().match(/\.(mp3|wav|ogg|m4a)$/)
  );

  const handleBack = () => {
    if (video) {
      navigate('/#midias');
    } else {
      navigate('/#devocionais');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-[#F9FAFB] flex flex-col font-sans">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-[#111827]/95 border-b border-[#374151] backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 sm:h-20">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-[#9CA3AF] hover:text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Início</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-xs font-bold transition text-[#9CA3AF] hover:text-white cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            <span>{copied ? 'Link Copiado!' : 'Compartilhar'}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <RefreshCw className="w-8 h-8 text-[#0077C8] animate-spin" />
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#9CA3AF]">
              Carregando conteúdo...
            </p>
          </div>
        )}

        {errorMessage && !isLoading && (
          <div className="bg-[#111827] border border-rose-800/80 rounded-2xl p-8 text-center space-y-4 shadow-lg my-8">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
            <div className="space-y-1">
              <h2 className="font-bold text-lg text-white">Conteúdo não disponível</h2>
              <p className="text-xs sm:text-sm text-[#9CA3AF] max-w-md mx-auto">
                {errorMessage}
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2.5 bg-[#0077C8] hover:bg-[#005F9E] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Voltar para a Página Principal
              </button>
            </div>
          </div>
        )}

        {/* ── Visualização de Estudo / Devocional ── */}
        {study && !isLoading && (
          <article className="space-y-8 animate-fade-in">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#0077C8]/20 border border-[#0077C8]/40 text-[#0077C8]">
                  {study.type || 'Devocional'}
                </span>
                {study.topic && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#1F2937] text-[#9CA3AF] border border-[#374151]">
                    {study.topic}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white tracking-tight leading-tight">
                {getStudyTitle(study)}
              </h1>

              <div className="flex items-center gap-3 text-xs sm:text-sm text-[#9CA3AF]">
                <span>Ministério Teleios</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-[#0077C8]" />
                  {study.createdAt
                    ? new Date(study.createdAt).toLocaleDateString('pt-BR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'Recente'}
                </span>
              </div>
            </div>

            {(study.generatedImgUrl || study.aiImageUrl) && (
              <div className="rounded-2xl overflow-hidden border border-[#374151] shadow-2xl max-h-[460px]">
                <img
                  src={study.generatedImgUrl || study.aiImageUrl || ''}
                  alt={getStudyTitle(study)}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {isAudio && study.mediaFile?.driveWebViewLink && (
              <div className="p-5 bg-[#111827] border border-[#374151] rounded-2xl space-y-3 shadow-md">
                <div className="flex items-center gap-2 text-xs font-bold text-[#F5A800] uppercase tracking-wider">
                  <Volume2 className="w-4 h-4" />
                  <span>Áudio da Mensagem</span>
                </div>
                <audio controls className="w-full" src={study.mediaFile.driveWebViewLink}>
                  Seu navegador não suporta reprodução de áudio.
                </audio>
              </div>
            )}

            {study.summary && (
              <div className="p-6 sm:p-8 bg-[#111827] border-l-4 border-[#0077C8] rounded-r-2xl border-y border-r border-[#374151] shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0077C8] mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  <span>Resumo do Estudo</span>
                </h3>
                <p className="text-sm sm:text-base text-gray-200 leading-relaxed italic">
                  "{study.summary}"
                </p>
              </div>
            )}

            {study.content && !isStudyBinary(study) && (
              <div className="prose prose-invert max-w-none text-gray-200 leading-relaxed text-base sm:text-lg whitespace-pre-line space-y-4">
                {study.content}
              </div>
            )}

            {isPdf && (
              <div className="p-6 bg-[#111827] border border-[#374151] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#1F2937] rounded-xl text-amber-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Documento Anexo Disponível</h4>
                    <p className="text-xs text-[#9CA3AF]">
                      {study.mediaFile?.originalName || 'Estudo Bíblico em PDF'}
                    </p>
                  </div>
                </div>

                {study.mediaFile?.driveWebViewLink && (
                  <a
                    href={study.mediaFile.driveWebViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#0077C8] hover:bg-[#005F9E] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Documento</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                  </a>
                )}
              </div>
            )}
          </article>
        )}

        {/* ── Visualização de Vídeo ── */}
        {video && !isLoading && (
          <article className="space-y-8 animate-fade-in">
            <div className="space-y-4">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 border border-rose-500/40 text-rose-400 inline-block">
                Vídeo & Mensagem
              </span>
              <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white tracking-tight leading-tight">
                {video.title}
              </h1>

              <div className="flex items-center gap-3 text-xs sm:text-sm text-[#9CA3AF]">
                <span>Ministério Teleios</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  {video.publishedAt
                    ? new Date(video.publishedAt).toLocaleDateString('pt-BR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'Recente'}
                </span>
              </div>
            </div>

            {/* Video Player Embed */}
            <div className="aspect-video w-full rounded-2xl overflow-hidden border border-[#374151] shadow-2xl bg-black">
              {video.youtubeVideoId ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${video.youtubeVideoId}?autoplay=0&rel=0`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              ) : video.youtubeUrl ? (
                <iframe
                  src={video.youtubeUrl.replace('watch?v=', 'embed/')}
                  title={video.title}
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#9CA3AF] space-y-2">
                  <Play className="w-12 h-12 text-rose-500 opacity-60" />
                  <p className="text-xs">Mídia em processamento</p>
                </div>
              )}
            </div>

            {video.description && (
              <div className="p-6 sm:p-8 bg-[#111827] rounded-2xl border border-[#374151] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Sobre esta mensagem</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed whitespace-pre-line">
                  {video.description}
                </p>
              </div>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
