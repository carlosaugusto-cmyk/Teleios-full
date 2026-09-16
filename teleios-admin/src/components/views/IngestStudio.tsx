import React, { useState } from 'react';
import {
  UploadCloud,
  FileText,
  Video,
  Image as ImageIcon,
  Music,
  FolderOpen,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Send,
  Eye,
  Clock,
  HardDrive,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ContentCategory } from '../../types/index.ts';
import { apiFetch } from '../../services/api.service.ts';
import { DESTINATIONS } from '../../config/destinations.ts';

interface IngestStudioProps {
  onUploadSuccess: () => void;
  onNavigateToEstudos?: () => void;
}

type ModalType = 'estudo' | 'video' | 'galeria' | 'audio' | 'documento' | 'drive' | null;

export const IngestStudio: React.FC<IngestStudioProps> = ({
  onUploadSuccess,
  onNavigateToEstudos,
}) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Common form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('Ministério Teleios');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [textContent, setTextContent] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [textMode, setTextMode] = useState<'file' | 'text'>('text');

  // Google Drive Ingest state
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [driveSearch, setDriveSearch] = useState('');
  const [selectedDriveFile, setSelectedDriveFile] = useState<any | null>(null);
  const [driveCategory, setDriveCategory] = useState<string>('ESTUDO');
  const [driveTitle, setDriveTitle] = useState('');
  const [driveAutoDispatch, setDriveAutoDispatch] = useState(false);
  const [isImportingDrive, setIsImportingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const loadDriveFilesForIngest = async () => {
    setIsLoadingDriveFiles(true);
    setDriveError(null);
    try {
      const res = await apiFetch('/api/integrations/drive/files');
      const json = await res.json();
      if (json.success && Array.isArray(json.files)) {
        setDriveFiles(json.files.filter((f: any) => !f.isFolder));
      } else {
        setDriveError(json.error || 'Google Drive ainda não configurado ou sem arquivos.');
      }
    } catch (err: any) {
      setDriveError(err.message || 'Erro ao conectar ao Drive.');
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  const handleImportDriveSubmit = async () => {
    if (!selectedDriveFile) return;
    setIsImportingDrive(true);
    setDriveError(null);

    try {
      const res = await apiFetch('/api/integrations/drive/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: selectedDriveFile.id,
          category: driveCategory,
          title: driveTitle.trim() || selectedDriveFile.name,
          autoDispatchWhatsapp: driveAutoDispatch,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
        setStatusMessage({
          type: 'success',
          text: json.message || 'Arquivo do Google Drive importado com sucesso!',
        });
        closeModal();
        onUploadSuccess();
      } else {
        throw new Error(json.error || 'Falha ao importar do Google Drive.');
      }
    } catch (err: any) {
      setDriveError(err.message || 'Erro ao importar.');
    } finally {
      setIsImportingDrive(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAuthor('Ministério Teleios');
    setSelectedFile(null);
    setSelectedFiles([]);
    setTextContent('');
    setIsPublished(true);
    setTextMode('text');
  };

  const closeModal = () => {
    setActiveModal(null);
    resetForm();
  };

  const handleUploadSubmit = async (category: ContentCategory) => {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('scheduleTime', 'immediate');
      formData.append('recipient', DESTINATIONS.whatsapp.defaultRecipient);

      if (category === ContentCategory.ESTUDO) {
        if (textMode === 'file' && selectedFile) {
          formData.append('file', selectedFile);
          formData.append('fileName', selectedFile.name);
          formData.append('mimeType', selectedFile.type || 'text/plain');
        } else {
          formData.append('textContent', textContent);
          formData.append('fileName', title ? `${title.replace(/\s+/g, '_')}.txt` : 'estudo.txt');
          formData.append('mimeType', 'text/plain');
        }
      } else if (category === ContentCategory.VIDEO) {
        if (selectedFile) {
          formData.append('file', selectedFile);
          formData.append('fileName', selectedFile.name);
          formData.append('mimeType', selectedFile.type || 'video/mp4');
        }
        formData.append('videoTitle', title);
        formData.append('videoDescription', description);
      } else if (category === ContentCategory.GALERIA) {
        if (selectedFiles.length > 0) {
          formData.append('file', selectedFiles[0]);
          formData.append('fileName', selectedFiles[0].name);
          formData.append('mimeType', selectedFiles[0].type || 'image/jpeg');
        } else if (selectedFile) {
          formData.append('file', selectedFile);
          formData.append('fileName', selectedFile.name);
          formData.append('mimeType', selectedFile.type || 'image/jpeg');
        }
      } else {
        // ÁUDIO / PROJETO / APOIO
        if (selectedFile) {
          formData.append('file', selectedFile);
          formData.append('fileName', selectedFile.name);
          formData.append('mimeType', selectedFile.type || 'application/octet-stream');
        }
      }

      const res = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
        setStatusMessage({ type: 'success', text: 'Conteúdo enviado e catalogado com sucesso!' });
        closeModal();
        onUploadSuccess();
      } else {
        throw new Error(data.error || 'Falha ao enviar arquivo.');
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Erro ao processar o upload.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadCards = [
    {
      type: 'estudo' as const,
      title: 'Estudo Bíblico',
      description: 'Envie estudos em texto ou anexe arquivos (.txt, .pdf, .docx).',
      icon: FileText,
      color: 'text-[#0077C8]',
      badgeBg: 'bg-[#0077C8]/10 border-[#0077C8]/30',
      category: ContentCategory.ESTUDO,
    },
    {
      type: 'video' as const,
      title: 'Vídeo & Pregação',
      description: 'Envie pregações em MP4 ou cadastre vídeos para publicação.',
      icon: Video,
      color: 'text-[#EF4444]',
      badgeBg: 'bg-[#EF4444]/10 border-[#EF4444]/30',
      category: ContentCategory.VIDEO,
    },
    {
      type: 'galeria' as const,
      title: 'Fotos da Galeria',
      description: 'Envie imagens de encontros, cultos e ações sociais do ministério.',
      icon: ImageIcon,
      color: 'text-[#10B981]',
      badgeBg: 'bg-[#10B981]/10 border-[#10B981]/30',
      category: ContentCategory.GALERIA,
    },
    {
      type: 'audio' as const,
      title: 'Áudio & Podcast',
      description: 'Envie locuções devocionais, mensagens de voz ou louvores em áudio.',
      icon: Music,
      color: 'text-[#F5A800]',
      badgeBg: 'bg-[#F5A800]/10 border-[#F5A800]/30',
      category: ContentCategory.APOIO,
    },
    {
      type: 'documento' as const,
      title: 'Documento de Projeto',
      description: 'Relatórios, especificações técnicas e materiais de apoio (.pdf, .docx).',
      icon: FolderOpen,
      color: 'text-purple-400',
      badgeBg: 'bg-purple-900/20 border-purple-700/30',
      category: ContentCategory.PROJETO,
    },
    {
      type: 'drive' as const,
      title: 'Google Drive',
      description: 'Importe estudos, fotos ou vídeos diretamente do Google Drive com 1 clique.',
      icon: HardDrive,
      color: 'text-amber-400',
      badgeBg: 'bg-amber-950/20 border-amber-800/30',
      category: ContentCategory.ESTUDO,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-8 min-w-0 w-full">
      {/* Header */}
      <div className="border-b border-[#374151] pb-4 sm:pb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6 text-[#0077C8] shrink-0" />
          <span>Central de Envio de Conteúdo</span>
        </h2>
        <p className="text-xs sm:text-sm text-[#9CA3AF] mt-1 leading-relaxed">
          Selecione o tipo de mídia para abrir o formulário dedicado com os campos específicos.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 sm:p-4 rounded-xl flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-900/30 border border-emerald-800 text-emerald-300'
              : 'bg-rose-900/30 border border-rose-800 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" /> : <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* SELETOR DE MODAIS ESPECÍFICOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
        {uploadCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.type}
              onClick={() => {
                resetForm();
                if (card.type === 'drive') {
                  loadDriveFilesForIngest();
                }
                setActiveModal(card.type);
              }}
              className="bg-[#111827] border border-[#374151] hover:border-[#0077C8] rounded-2xl p-4 sm:p-6 cursor-pointer group transition-all duration-200 flex flex-col justify-between space-y-3.5 sm:space-y-4 hover:shadow-xl hover:shadow-[#0077C8]/5"
            >
              <div className="space-y-3">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${card.badgeBg}`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-[#F5A800] transition-colors">{card.title}</h3>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">{card.description}</p>
              </div>

              <div className="pt-3 border-t border-[#374151]/50 flex items-center justify-between text-xs font-semibold text-[#0077C8] group-hover:translate-x-1 transition-transform">
                <span>Abrir Formulário</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* 1. MODAL DEDICADO: ESTUDO BÍBLICO */}
      {/* ============================================================ */}
      {activeModal === 'estudo' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-[#111827] rounded-2xl border border-[#374151] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#374151] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#0077C8]/10 text-[#0077C8] rounded-xl border border-[#0077C8]/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Publicar Novo Estudo Bíblico</h3>
                  <p className="text-xs text-[#9CA3AF]">Preencha os dados do estudo e anexe o conteúdo.</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 text-[#9CA3AF] hover:text-white rounded-lg bg-[#1F2937]"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Título do Estudo *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: A Armadura de Deus — Efésios 6"
                    className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:border-[#0077C8]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Autor / Preletor</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2.5 rounded-lg text-sm text-white"
                  />
                </div>
              </div>

              {/* Toggle Modo Arquivo vs Texto */}
              <div className="flex gap-2 bg-[#1F2937] p-1 rounded-lg border border-[#374151]">
                <button
                  type="button"
                  onClick={() => setTextMode('text')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${textMode === 'text' ? 'bg-[#0077C8] text-white' : 'text-[#9CA3AF]'}`}
                >
                  Digitar / Colar Texto
                </button>
                <button
                  type="button"
                  onClick={() => setTextMode('file')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${textMode === 'file' ? 'bg-[#0077C8] text-white' : 'text-[#9CA3AF]'}`}
                >
                  Anexar Arquivo (.txt, .pdf, .docx)
                </button>
              </div>

              {textMode === 'text' ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Conteúdo do Estudo *</label>
                  <textarea
                    rows={6}
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Cole ou redija o texto completo do estudo..."
                    className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:border-[#0077C8]"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Selecionar Arquivo *</label>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2 rounded-lg text-xs text-[#9CA3AF]"
                    accept=".txt,.pdf,.docx,.doc"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="pub-estudo"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded bg-[#1F2937] border-[#374151] text-[#0077C8]"
                />
                <label htmlFor="pub-estudo" className="text-xs text-white">Publicar imediatamente na página de Mídias</label>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-[#374151]">
              <button onClick={closeModal} className="px-4 py-2.5 bg-[#1F2937] hover:bg-[#374151] text-white rounded-xl text-xs font-semibold cursor-pointer text-center">Cancelar</button>
              <button
                onClick={() => handleUploadSubmit(ContentCategory.ESTUDO)}
                disabled={isSubmitting || (!textContent && !selectedFile)}
                className="px-6 py-2.5 bg-[#0077C8] hover:bg-[#005F9E] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow disabled:opacity-50"
              >
                {isSubmitting ? 'Enviando...' : 'Publicar Estudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. MODAL DEDICADO: VÍDEO */}
      {/* ============================================================ */}
      {activeModal === 'video' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={closeModal}>
          <div className="bg-[#111827] rounded-2xl border border-[#374151] max-w-2xl w-full p-4 sm:p-8 space-y-4 sm:space-y-6 shadow-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#374151] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#EF4444]/10 text-[#EF4444] rounded-xl border border-[#EF4444]/30 shrink-0">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">Publicar Novo Vídeo</h3>
                  <p className="text-xs text-[#9CA3AF]">Cadastre pregações e mensagens em vídeo.</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 text-[#9CA3AF] hover:text-white rounded-xl bg-[#1F2937] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3.5 sm:space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Título do Vídeo *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Mensagem de Domingo — Pr. Convidado"
                  className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-[#EF4444]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Descrição do Vídeo</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve resumo sobre a pregação ou tema abordado..."
                  className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-[#EF4444]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Arquivo de Vídeo (.mp4) ou Arquivo de Mídia</label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2 rounded-xl text-xs text-[#9CA3AF]"
                  accept="video/*"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-[#374151]">
              <button onClick={closeModal} className="px-4 py-2.5 bg-[#1F2937] hover:bg-[#374151] text-white rounded-xl text-xs font-semibold cursor-pointer text-center">Cancelar</button>
              <button
                onClick={() => handleUploadSubmit(ContentCategory.VIDEO)}
                disabled={isSubmitting || !title}
                className="px-6 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow disabled:opacity-50"
              >
                {isSubmitting ? 'Enviando...' : 'Salvar Vídeo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. MODAL DEDICADO: GALERIA DE FOTOS */}
      {/* ============================================================ */}
      {activeModal === 'galeria' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-[#111827] rounded-2xl border border-[#374151] max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#374151] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#10B981]/10 text-[#10B981] rounded-xl border border-[#10B981]/30">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Enviar Fotos para a Galeria</h3>
                  <p className="text-xs text-[#9CA3AF]">Selecione uma ou mais imagens para catalogação.</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 text-[#9CA3AF] hover:text-white rounded-lg bg-[#1F2937]"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Título / Identificação do Evento</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Encontro de Jovens - Julho 2026"
                  className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2.5 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Selecionar Imagens (JPG, PNG, WebP) *</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      setSelectedFiles(Array.from(e.target.files));
                    }
                  }}
                  className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2 rounded-lg text-xs text-[#9CA3AF]"
                  accept="image/*"
                />
              </div>

              {selectedFiles.length > 0 && (
                <div className="bg-[#1F2937]/50 p-3 rounded-lg text-xs text-[#10B981] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{selectedFiles.length} imagem(ns) selecionada(s) para upload.</span>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-[#374151]">
              <button onClick={closeModal} className="px-4 py-2.5 bg-[#1F2937] hover:bg-[#374151] text-white rounded-xl text-xs font-semibold cursor-pointer text-center">Cancelar</button>
              <button
                onClick={() => handleUploadSubmit(ContentCategory.GALERIA)}
                disabled={isSubmitting || selectedFiles.length === 0}
                className="px-6 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow disabled:opacity-50"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Fotos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. MODAL DEDICADO: ÁUDIO */}
      {/* ============================================================ */}
      {activeModal === 'audio' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={closeModal}>
          <div className="bg-[#111827] rounded-2xl border border-[#374151] max-w-xl w-full p-4 sm:p-8 space-y-4 sm:space-y-6 shadow-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#374151] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#F5A800]/10 text-[#F5A800] rounded-xl border border-[#F5A800]/30 shrink-0">
                  <Music className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">Enviar Mensagem em Áudio</h3>
                  <p className="text-xs text-[#9CA3AF]">Locuções, devocionais falados e arquivos sonoros.</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 text-[#9CA3AF] hover:text-white rounded-xl bg-[#1F2937] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3.5 sm:space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Título do Áudio *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Devocional da Manhã - Salmo 23"
                  className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-[#F5A800]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Arquivo de Áudio (.mp3, .wav, .m4a) *</label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2 rounded-xl text-xs text-[#9CA3AF]"
                  accept="audio/*"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-[#374151]">
              <button onClick={closeModal} className="px-4 py-2.5 bg-[#1F2937] hover:bg-[#374151] text-white rounded-xl text-xs font-semibold cursor-pointer text-center">Cancelar</button>
              <button
                onClick={() => handleUploadSubmit(ContentCategory.APOIO)}
                disabled={isSubmitting || !selectedFile}
                className="px-6 py-2.5 bg-[#F5A800] hover:bg-[#D97706] text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow disabled:opacity-50"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Áudio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. MODAL DEDICADO: DOCUMENTO DE PROJETO */}
      {/* ============================================================ */}
      {activeModal === 'documento' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={closeModal}>
          <div className="bg-[#111827] rounded-2xl border border-[#374151] max-w-xl w-full p-4 sm:p-8 space-y-4 sm:space-y-6 shadow-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#374151] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-900/20 text-purple-400 rounded-xl border border-purple-700/30 shrink-0">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">Anexar Documento de Projeto</h3>
                  <p className="text-xs text-[#9CA3AF]">Relatórios, propostas sociais e materiais de apoio.</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 text-[#9CA3AF] hover:text-white rounded-xl bg-[#1F2937] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3.5 sm:space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Nome do Documento / Ação</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Relatório de Atendimento Mesa Solidária"
                  className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Arquivo (.pdf, .docx, .xlsx) *</label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2 rounded-xl text-xs text-[#9CA3AF]"
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-[#374151]">
              <button onClick={closeModal} className="px-4 py-2.5 bg-[#1F2937] hover:bg-[#374151] text-white rounded-xl text-xs font-semibold cursor-pointer text-center">Cancelar</button>
              <button
                onClick={() => handleUploadSubmit(ContentCategory.PROJETO)}
                disabled={isSubmitting || !selectedFile}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow disabled:opacity-50"
              >
                {isSubmitting ? 'Enviando...' : 'Salvar Documento'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ============================================================ */}
      {/* 6. MODAL DEDICADO: GOOGLE DRIVE */}
      {/* ============================================================ */}
      {activeModal === 'drive' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={closeModal}>
          <div
            className="bg-[#111827] border border-[#374151] rounded-2xl max-w-xl w-full p-4 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#374151] pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-400 flex items-center justify-center">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">Importar do Google Drive</h3>
                  <p className="text-xs text-[#9CA3AF]">Selecione um arquivo da sua nuvem para ingestão direta.</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 text-[#9CA3AF] hover:text-white rounded-xl bg-[#1F2937] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {driveError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{driveError}</span>
              </div>
            )}

            {/* Busca e Lista de Arquivos */}
            <div className="space-y-3 flex-1 overflow-hidden flex flex-col min-h-0 text-xs">
              <div className="relative shrink-0">
                <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={driveSearch}
                  onChange={(e) => setDriveSearch(e.target.value)}
                  placeholder="Pesquisar arquivos no Drive..."
                  className="w-full pl-9 pr-3.5 py-2 bg-[#1F2937] border border-[#374151] rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px] max-h-[220px]">
                {isLoadingDriveFiles ? (
                  <div className="py-8 text-center text-[#9CA3AF] flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                    <span>Carregando arquivos do Drive...</span>
                  </div>
                ) : driveFiles.filter((f) => !driveSearch || f.name.toLowerCase().includes(driveSearch.toLowerCase())).length === 0 ? (
                  <div className="py-6 text-center text-[#9CA3AF] bg-[#1F2937]/30 rounded-xl border border-dashed border-[#374151]">
                    Nenhum arquivo encontrado no Google Drive.
                  </div>
                ) : (
                  driveFiles
                    .filter((f) => !driveSearch || f.name.toLowerCase().includes(driveSearch.toLowerCase()))
                    .map((file) => {
                      const isSelected = selectedDriveFile?.id === file.id;
                      return (
                        <div
                          key={file.id}
                          onClick={() => {
                            setSelectedDriveFile(file);
                            setDriveTitle(file.name.replace(/\.[^.]+$/, ''));
                            if (file.mimeType.startsWith('image/')) setDriveCategory('GALERIA');
                            else if (file.mimeType.startsWith('video/')) setDriveCategory('VIDEO');
                            else setDriveCategory('ESTUDO');
                          }}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition ${
                            isSelected
                              ? 'bg-amber-950/40 border-amber-500 text-white'
                              : 'bg-[#1F2937]/50 hover:bg-[#1F2937] border-[#374151] text-[#D1D5DB]'
                          }`}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-400' : 'text-[#9CA3AF]'}`} />
                            <span className="truncate font-medium">{file.name}</span>
                          </div>
                          <span className="text-[10px] text-[#9CA3AF] shrink-0 font-mono">
                            {file.size ? `${(file.size / 1024).toFixed(0)} KB` : 'Google Doc'}
                          </span>
                        </div>
                      );
                    })
                )}
              </div>

              {selectedDriveFile && (
                <div className="space-y-2.5 pt-2 border-t border-[#374151] shrink-0">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">
                      Título do Conteúdo:
                    </label>
                    <input
                      type="text"
                      value={driveTitle}
                      onChange={(e) => setDriveTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#1F2937] border border-[#374151] rounded-lg text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">
                        Categoria:
                      </label>
                      <select
                        value={driveCategory}
                        onChange={(e) => setDriveCategory(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#1F2937] border border-[#374151] rounded-lg text-white"
                      >
                        <option value="ESTUDO">Estudo / Devocional</option>
                        <option value="GALERIA">Foto da Galeria</option>
                        <option value="VIDEO">Vídeo / Pregação</option>
                        <option value="APOIO">Documento de Apoio</option>
                      </select>
                    </div>

                    <div className="flex items-end pb-1.5">
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-white">
                        <input
                          type="checkbox"
                          checked={driveAutoDispatch}
                          onChange={(e) => setDriveAutoDispatch(e.target.checked)}
                          className="rounded border-[#374151] text-amber-500"
                        />
                        <span>Disparar WhatsApp</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-[#374151] shrink-0">
              <button onClick={closeModal} className="px-4 py-2 bg-[#1F2937] hover:bg-[#374151] text-white rounded-xl text-xs font-semibold cursor-pointer text-center">
                Cancelar
              </button>
              <button
                onClick={handleImportDriveSubmit}
                disabled={isImportingDrive || !selectedDriveFile}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow"
              >
                {isImportingDrive ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importando do Drive...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Importar Arquivo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};