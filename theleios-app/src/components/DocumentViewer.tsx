import { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  AlertCircle,
  RefreshCw,
  File,
} from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { resolveDocumentUrl } from '../lib/api';

interface DocumentViewerProps {
  documentUrl: string;
  documentName?: string | null;
  documentType?: string | null;
  documentSize?: number | null;
  onClose?: () => void;
}

export default function DocumentViewer({
  documentUrl,
  documentName,
  documentType,
  documentSize,
}: DocumentViewerProps) {
  const fullDocUrl = resolveDocumentUrl(documentUrl);

  // Determinar o formato do documento
  const detectedType = (() => {
    if (documentType) {
      const lower = documentType.toLowerCase();
      if (lower.includes('pdf')) return 'pdf';
      if (lower.includes('docx')) return 'docx';
      if (lower.includes('doc')) return 'doc';
    }
    const cleanUrl = (documentName || documentUrl).split('?')[0].toLowerCase();
    if (cleanUrl.endsWith('.pdf')) return 'pdf';
    if (cleanUrl.endsWith('.docx')) return 'docx';
    if (cleanUrl.endsWith('.doc')) return 'doc';
    return 'pdf'; // padrão
  })();

  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Estados específicos para PDF
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  // Refs
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  // ─── 1. RENDERIZADOR DE DOCX (docx-preview) ──────────────────────────────────
  useEffect(() => {
    if (detectedType !== 'docx') return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadDocx = async () => {
      try {
        const response = await fetch(fullDocUrl);
        if (!response.ok) throw new Error(`Falha ao baixar arquivo DOCX (HTTP ${response.status}).`);
        const buffer = await response.arrayBuffer();

        if (isMounted && docxContainerRef.current) {
          docxContainerRef.current.innerHTML = '';
          await renderAsync(buffer, docxContainerRef.current, undefined, {
            className: 'docx-preview-rendered',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            breakPages: true,
          });
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('[DocxViewer Error]', err);
          setError(err.message || 'Não foi possível renderizar o arquivo DOCX.');
          setLoading(false);
        }
      }
    };

    loadDocx();

    return () => {
      isMounted = false;
    };
  }, [fullDocUrl, detectedType]);

  // ─── 2. RENDERIZADOR DE PDF (PDF.js com Fallback) ───────────────────────────
  useEffect(() => {
    if (detectedType !== 'pdf') return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadPdfDoc = async () => {
      try {
        // Baixa o binário primeiro garantindo CORS e status
        const response = await fetch(fullDocUrl);
        if (!response.ok) throw new Error(`Falha ao baixar arquivo PDF (HTTP ${response.status}).`);
        const buffer = await response.arrayBuffer();

        // Carrega PDF.js dinamicamente do CDN oficial para manter bundle leve
        const dynamicImport = new Function('u', 'return import(u)');
        const pdfjsLib: any = await dynamicImport(
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs'
        );

        // Configuração do Worker via Blob para contornar restrição de CORS em browsers modernos
        try {
          const workerResp = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs');
          if (workerResp.ok) {
            const workerCode = await workerResp.text();
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
          }
        } catch {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '';
        }

        const loadingTask = pdfjsLib.getDocument({
          data: buffer,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/cmaps/',
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (isMounted) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setCurrentPage(1);
          setLoading(false);
        }
      } catch (err: any) {
        console.warn('[PDF.js Canvas Error - Ativando Google Docs Fallback]', err);
        if (isMounted) {
          // Se falhar o carregamento do worker/canvas, ativa Google Docs Viewer fallback
          setUseIframeFallback(true);
          setLoading(false);
        }
      }
    };

    loadPdfDoc();

    return () => {
      isMounted = false;
    };
  }, [fullDocUrl, detectedType]);

  // Renderizar página atual do PDF no Canvas
  useEffect(() => {
    if (!pdfDoc || detectedType !== 'pdf' || useIframeFallback) return;

    let cancelRender = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelRender) return;

        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Otimização para telas Retina/Mobile
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * 1.3 });

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderContext = {
          canvasContext: context,
          viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.warn('[PDF Page Render Warning]', err);
      }
    };

    renderPage();

    return () => {
      cancelRender = true;
    };
  }, [pdfDoc, currentPage, scale, detectedType, useIframeFallback]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 2.5));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.6));
  const handleResetZoom = () => setScale(1);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const displayName = documentName || 'Documento';

  return (
    <div
      ref={containerWrapperRef}
      className={`flex flex-col bg-[#0F172A] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : 'w-full my-3'
      }`}
      style={{ minHeight: isFullscreen ? '100dvh' : '480px' }}
    >
      {/* Barra de Ferramentas / Header do Visor */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#1E293B] border-b border-gray-700/60 text-gray-200 select-none">
        {/* Lado Esquerdo: Ícone e Nome */}
        <div className="flex items-center gap-2.5 min-w-0 max-w-[50%]">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
            {detectedType === 'pdf' ? <FileText size={16} /> : <File size={16} />}
          </div>
          <div className="min-w-0">
            <span className="block font-semibold text-xs sm:text-sm text-white truncate" title={displayName}>
              {displayName}
            </span>
            <span className="text-[10px] text-gray-400 font-mono uppercase">
              {detectedType.toUpperCase()}
              {documentSize ? ` • ${(documentSize / 1024 / 1024).toFixed(1)} MB` : ''}
            </span>
          </div>
        </div>

        {/* Lado Direito: Ações e Controles */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Navegação de Página para PDF */}
          {detectedType === 'pdf' && !useIframeFallback && numPages > 1 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#0F172A] border border-gray-700 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage <= 1}
                className="p-1 text-gray-300 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Página anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="font-mono text-[11px] px-1 text-gray-300">
                {currentPage}/{numPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, numPages))}
                disabled={currentPage >= numPages}
                className="p-1 text-gray-300 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Próxima página"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Controles de Zoom */}
          <div className="flex items-center gap-0.5 bg-[#0F172A] border border-gray-700 rounded-lg p-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 rounded hover:bg-gray-800 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Reduzir zoom"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-1.5 py-0.5 text-[11px] font-mono text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Restaurar zoom"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 rounded hover:bg-gray-800 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Aumentar zoom"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Tela cheia */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 bg-[#0F172A] border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors cursor-pointer hidden sm:block"
            title={isFullscreen ? 'Sair da tela cheia' : 'Visualizar em tela cheia'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Alternador de Modo para PDF (Canvas vs Google Docs Viewer) */}
          {detectedType === 'pdf' && (
            <button
              type="button"
              onClick={() => setUseIframeFallback((prev) => !prev)}
              className="px-2 py-1 bg-[#0F172A] border border-gray-700 hover:border-gray-500 rounded-lg text-gray-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
              title={useIframeFallback ? 'Alternar para Leitor Canvas Nativo' : 'Alternar para Leitor Google Docs'}
            >
              {useIframeFallback ? 'Modo Canvas' : 'Modo Docs'}
            </button>
          )}

          {/* Download / Abrir Original */}
          <a
            href={fullDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={displayName}
            className="p-1.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
            title="Baixar ou abrir documento original"
          >
            <Download size={14} />
            <span className="hidden md:inline">Baixar</span>
          </a>
        </div>
      </div>

      {/* Área Central de Visualização */}
      <div className="flex-1 relative overflow-auto bg-[#0A0F1A] flex items-center justify-center p-2 sm:p-4">
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0A0F1A]/80 backdrop-blur-xs gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-xs text-gray-300 font-medium">Renderizando {detectedType.toUpperCase()}...</span>
          </div>
        )}

        {/* Mensagem de Erro com Ação */}
        {error && (
          <div className="p-6 text-center max-w-md bg-[#1E293B] border border-red-500/40 rounded-2xl space-y-3">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-sm font-semibold text-white">Falha ao abrir documento no visor integrado</p>
            <p className="text-xs text-gray-400">{error}</p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <a
                href={`https://docs.google.com/viewer?url=${encodeURIComponent(fullDocUrl)}&embedded=true`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <ExternalLink size={14} />
                <span>Abrir no Google Docs</span>
              </a>
              <a
                href={fullDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2 bg-[#0F172A] hover:bg-gray-800 border border-gray-700 text-gray-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Download size={14} />
                <span>Baixar Original</span>
              </a>
            </div>
          </div>
        )}

        {/* ─── Render DOCX ─── */}
        {detectedType === 'docx' && !error && (
          <div
            className="w-full h-full overflow-auto flex justify-center"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top center', transition: 'transform 0.15s ease-out' }}
          >
            <div
              ref={docxContainerRef}
              className="docx-render-container w-full max-w-3xl bg-white text-gray-900 rounded-xl shadow-lg p-6 sm:p-10 font-serif leading-relaxed text-sm min-h-full"
            />
          </div>
        )}

        {/* ─── Render PDF (Canvas ou Fallback Iframe) ─── */}
        {detectedType === 'pdf' && !error && (
          <>
            {useIframeFallback ? (
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(fullDocUrl)}&embedded=true`}
                title={displayName}
                className="w-full h-full border-none rounded-lg bg-white"
                style={{ minHeight: isFullscreen ? 'calc(100dvh - 60px)' : '520px' }}
              />
            ) : (
              <div
                className="w-full h-full overflow-auto flex justify-center items-start"
                style={{ transition: 'transform 0.15s ease-out' }}
              >
                <div className="bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-700/60 my-auto">
                  <canvas ref={pdfCanvasRef} className="block mx-auto max-w-full h-auto" />
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Render DOC Legado ─── */}
        {detectedType === 'doc' && (
          <div className="p-8 text-center max-w-md bg-[#1E293B] border border-[#374151] rounded-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-950/70 border border-blue-700/40 text-blue-400 flex items-center justify-center mx-auto">
              <File size={28} />
            </div>
            <div>
              <h4 className="text-base font-bold text-white mb-1">{displayName}</h4>
              <p className="text-xs text-gray-400">
                Este arquivo está no formato Word 97-2003 (.doc). Para máxima fidelidade visual, você pode abri-lo diretamente ou pelo Google Docs.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <a
                href={`https://docs.google.com/viewer?url=${encodeURIComponent(fullDocUrl)}&embedded=true`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
              >
                <ExternalLink size={14} />
                <span>Visualizador Online</span>
              </a>
              <a
                href={fullDocUrl}
                download={displayName}
                className="w-full sm:w-auto px-4 py-2 bg-[#0F172A] hover:bg-[#1E293B] border border-gray-700 text-gray-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Download size={14} />
                <span>Baixar DOC</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
