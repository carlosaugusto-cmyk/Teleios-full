import { useEffect, useRef, useState, useCallback } from 'react';
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
  Sun,
  Moon,
  BookOpen,
} from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { resolveDocumentUrl } from '../lib/api';

type ReadingTheme = 'escuro' | 'sepia' | 'claro';

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
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>('escuro');

  // Estados específicos para PDF
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  // Refs
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  // ─── 1. RENDERIZADOR DE DOCX (docx-preview com Edge-to-Edge) ────────────────
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
            inWrapper: false,
            ignoreWidth: true,
            ignoreHeight: true,
            breakPages: false,
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

  // Renderizar página atual do PDF no Canvas com Auto-Fit Edge-to-Edge
  const renderPdfPage = useCallback(async () => {
    if (!pdfDoc || detectedType !== 'pdf' || useIframeFallback) return;

    try {
      const page = await pdfDoc.getPage(currentPage);
      const canvas = pdfCanvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = containerWrapperRef.current?.clientWidth || window.innerWidth;
      // Preenche 100% da largura da tela no mobile para leitura sem aperto
      const availableWidth = Math.max(containerWidth, 320);
      const fitScale = (availableWidth / viewport.width) * scale;
      const finalViewport = page.getViewport({ scale: fitScale });

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(finalViewport.width * dpr);
      canvas.height = Math.floor(finalViewport.height * dpr);
      canvas.style.width = `${Math.floor(finalViewport.width)}px`;
      canvas.style.height = `${Math.floor(finalViewport.height)}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderContext = {
        canvasContext: context,
        viewport: finalViewport,
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.warn('[PDF Page Render Warning]', err);
    }
  }, [pdfDoc, currentPage, scale, detectedType, useIframeFallback]);

  useEffect(() => {
    renderPdfPage();
  }, [renderPdfPage]);

  // Re-ajustar PDF ao redimensionar a tela/girar celular
  useEffect(() => {
    let resizeTimer: any;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderPdfPage();
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [renderPdfPage]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));
  const handleResetZoom = () => setScale(1);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const displayName = documentName || 'Documento';

  return (
    <div
      ref={containerWrapperRef}
      className={`flex flex-col w-full overflow-hidden transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-50 rounded-none border-none'
          : 'rounded-none border-none m-0 p-0'
      }`}
      style={{ minHeight: isFullscreen ? '100dvh' : 'calc(100dvh - 120px)' }}
    >
      {/* Barra de Ferramentas / Header do Visor */}
      <div className="bg-[#1E293B] border-b border-gray-700/60 text-gray-200 select-none">
        {/* Linha 1: Título e Ações Principais */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-700/40">
          <div className="flex items-center gap-2 min-w-0 max-w-[65%]">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
              {detectedType === 'pdf' ? <FileText size={15} /> : <File size={15} />}
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

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Tela cheia */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 bg-[#0F172A] border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? 'Sair da tela cheia' : 'Visualizar em tela cheia'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            {/* Download / Abrir Original */}
            <a
              href={fullDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={displayName}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
              title="Baixar ou abrir documento original"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Baixar</span>
            </a>
          </div>
        </div>

        {/* Linha 2: Controles de Leitura (Modo Escuro / Sépia / Claro, Zoom e Paginação) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#162032] text-xs">
          {/* Seletor de Modo de Leitura */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 uppercase font-semibold mr-1 hidden sm:inline">Leitura:</span>
            <div className="inline-flex rounded-lg bg-[#0F172A] border border-gray-700 p-0.5">
              <button
                type="button"
                onClick={() => setReadingTheme('claro')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  readingTheme === 'claro'
                    ? 'bg-amber-400 text-gray-950 font-bold shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Modo Claro (Página branca original)"
              >
                <Sun size={12} />
                <span>Claro</span>
              </button>
              <button
                type="button"
                onClick={() => setReadingTheme('sepia')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  readingTheme === 'sepia'
                    ? 'bg-[#E4D1B5] text-[#362712] font-bold shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Modo Sépia (Conforto visual tipo livro)"
              >
                <BookOpen size={12} />
                <span>Sépia</span>
              </button>
              <button
                type="button"
                onClick={() => setReadingTheme('escuro')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  readingTheme === 'escuro'
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Modo Escuro (Fundo escuro, alto contraste para descanso visual)"
              >
                <Moon size={12} />
                <span>Escuro</span>
              </button>
            </div>
          </div>

          {/* Controles de Zoom e Alternador Docs */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Navegação de Página para PDF */}
            {detectedType === 'pdf' && !useIframeFallback && numPages > 1 && (
              <div className="flex items-center gap-0.5 px-1 py-0.5 bg-[#0F172A] border border-gray-700 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage <= 1}
                  className="p-1 text-gray-300 hover:text-white disabled:opacity-30 cursor-pointer"
                  title="Página anterior"
                >
                  <ChevronLeft size={13} />
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
                  <ChevronRight size={13} />
                </button>
              </div>
            )}

            {/* Controles de Zoom */}
            <div className="flex items-center gap-0.5 bg-[#0F172A] border border-gray-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 rounded hover:bg-gray-800 text-gray-300 hover:text-white transition-colors cursor-pointer"
                title="Reduzir zoom"
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-1.5 py-0.5 text-[11px] font-mono text-gray-300 hover:text-white transition-colors cursor-pointer"
                title="Ajustar à largura da tela (100%)"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 rounded hover:bg-gray-800 text-gray-300 hover:text-white transition-colors cursor-pointer"
                title="Aumentar zoom"
              >
                <ZoomIn size={13} />
              </button>
            </div>

            {/* Alternador de Leitor para PDF */}
            {detectedType === 'pdf' && (
              <button
                type="button"
                onClick={() => setUseIframeFallback((prev) => !prev)}
                className="px-2 py-1 bg-[#0F172A] border border-gray-700 hover:border-gray-500 rounded-lg text-gray-300 hover:text-white text-[10px] sm:text-[11px] font-medium transition-colors cursor-pointer"
                title={useIframeFallback ? 'Alternar para Leitor Canvas Nativo' : 'Alternar para Leitor Google Docs'}
              >
                {useIframeFallback ? 'Canvas' : 'Docs'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Área Central de Visualização (Sem margem lateral, 100% da tela) */}
      <div
        className={`flex-1 relative overflow-auto flex items-center justify-center p-0 transition-colors ${
          readingTheme === 'escuro'
            ? 'bg-[#090D16]'
            : readingTheme === 'sepia'
            ? 'bg-[#EFE5D3]'
            : 'bg-[#E2E8F0]'
        } reading-theme-${readingTheme}`}
      >
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0A0F1A]/80 backdrop-blur-xs gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-xs text-gray-300 font-medium">Renderizando {detectedType.toUpperCase()}...</span>
          </div>
        )}

        {/* Mensagem de Erro com Ação */}
        {error && (
          <div className="m-4 p-6 text-center max-w-md bg-[#1E293B] border border-red-500/40 rounded-2xl space-y-3">
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

        {/* ─── Render DOCX Edge-to-Edge ─── */}
        {detectedType === 'docx' && !error && (
          <div
            className="w-full h-full overflow-auto flex justify-center p-0"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top center', transition: 'transform 0.15s ease-out' }}
          >
            <div
              ref={docxContainerRef}
              className={`docx-render-container w-full font-serif leading-relaxed text-sm min-h-full ${
                readingTheme === 'escuro'
                  ? 'bg-[#0f172a] text-[#f1f5f9]'
                  : readingTheme === 'sepia'
                  ? 'bg-[#fcf6ea] text-[#3b2c1a]'
                  : 'bg-white text-gray-900'
              }`}
            />
          </div>
        )}

        {/* ─── Render PDF (Canvas ou Fallback Iframe) Edge-to-Edge ─── */}
        {detectedType === 'pdf' && !error && (
          <>
            {useIframeFallback ? (
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(fullDocUrl)}&embedded=true`}
                title={displayName}
                className="w-full h-full border-none"
                style={{
                  minHeight: isFullscreen ? 'calc(100dvh - 85px)' : 'calc(100dvh - 170px)',
                  filter:
                    readingTheme === 'escuro'
                      ? 'invert(0.92) hue-rotate(180deg) brightness(0.95)'
                      : readingTheme === 'sepia'
                      ? 'sepia(0.35) contrast(0.95) brightness(0.96)'
                      : 'none',
                }}
              />
            ) : (
              <div
                className="w-full h-full overflow-auto flex justify-center items-start p-0"
                style={{ transition: 'transform 0.15s ease-out' }}
              >
                <div
                  className="w-full shadow-none overflow-hidden my-auto flex justify-center"
                  style={{
                    filter:
                      readingTheme === 'escuro'
                        ? 'invert(0.92) hue-rotate(180deg) brightness(0.95)'
                        : readingTheme === 'sepia'
                        ? 'sepia(0.4) contrast(0.95) brightness(0.96)'
                        : 'none',
                  }}
                >
                  <canvas ref={pdfCanvasRef} className="block mx-auto max-w-none" />
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Render DOC Legado ─── */}
        {detectedType === 'doc' && (
          <div className="m-4 p-8 text-center max-w-md bg-[#1E293B] border border-[#374151] rounded-2xl space-y-4">
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
