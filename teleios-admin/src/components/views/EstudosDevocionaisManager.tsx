import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  GraduationCap,
  Plus,
  Search,
  Trash2,
  Edit2,
  Eye,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Calendar,
  Image as ImageIcon,
  ChevronLeft,
  Filter,
  FileText,
  Download,
  File,
  Paperclip,
} from 'lucide-react';
import { Study } from '../../types/index.ts';
import { apiFetch } from '../../services/api.service.ts';
import { safeApiFetch } from '../../utils/contentSanitizer.ts';
import { BIBLE_BOOKS, extractBibleReference, BibleBookInfo } from '../../utils/bibleExtractor.ts';
import { uploadImageWithThumbnail } from '../../utils/imageOptimizer.ts';

interface EstudosDevocionaisManagerProps {
  defaultTab?: 'devocionais' | 'estudos';
}

export const EstudosDevocionaisManager: React.FC<EstudosDevocionaisManagerProps> = ({ defaultTab = 'devocionais' }) => {
  const [activeTab, setActiveTab] = useState<'devocionais' | 'estudos'>(defaultTab);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const [studies, setStudies] = useState<Study[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ─── Paginação de Devocionais ──────────────────────────────────────────────
  const [devocionaisPage, setDevocionaisPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  // ─── Acordeão de Estudos por Livro ─────────────────────────────────────────
  const [expandedBooks, setExpandedBooks] = useState<Record<string, boolean>>({});

  // ─── Modais ────────────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Study | null>(null);
  const [viewingItem, setViewingItem] = useState<Study | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Study | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ─── Estados do Formulário e Validação ─────────────────────────────────────
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formBook, setFormBook] = useState('');
  const [formChapter, setFormChapter] = useState<number | ''>('');
  const [autoDetected, setAutoDetected] = useState<{ book: string; chapter: number } | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [existingDoc, setExistingDoc] = useState<{
    url: string;
    name: string;
    type?: string | null;
    size?: number | null;
  } | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    title?: string;
    content?: string;
    book?: string;
    chapter?: string;
    cover?: string;
    doc?: string;
  }>({});

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await safeApiFetch<Study[]>('/api/estudos?all=true');
      if (res.success && Array.isArray(res.data)) {
        setStudies(res.data);
      } else {
        setStudies([]);
      }
    } catch {
      setStudies([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Separação por tipo de conteúdo
  const devocionais = useMemo(() => {
    return studies.filter((s) => s.type === 'Devocional');
  }, [studies]);

  const estudos = useMemo(() => {
    return studies.filter((s) => s.type === 'Estudo');
  }, [studies]);

  // Detector automático em tempo real no modal de Estudo
  useEffect(() => {
    if (activeTab === 'estudos' && isModalOpen) {
      const detected = extractBibleReference(`${formTitle} ${formContent}`);
      if (detected) {
        setAutoDetected(detected);
        // Preenche automaticamente apenas se ainda estiver vazio ou se foi alterado
        if (!formBook || autoDetected?.book !== detected.book) {
          setFormBook(detected.book);
        }
        if (!formChapter || autoDetected?.chapter !== detected.chapter) {
          setFormChapter(detected.chapter);
        }
      } else {
        setAutoDetected(null);
      }
    }
  }, [formTitle, formContent, activeTab, isModalOpen]);

  // Preview de imagem de capa selecionada
  useEffect(() => {
    if (coverFile) {
      const url = URL.createObjectURL(coverFile);
      setCoverPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [coverFile]);

  // Reset de página ao buscar
  useEffect(() => {
    setDevocionaisPage(1);
  }, [searchTerm, activeTab]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormContent('');
    setFormBook('');
    setFormChapter('');
    setAutoDetected(null);
    setCoverFile(null);
    setCoverPreviewUrl('');
    setDocFile(null);
    setExistingDoc(null);
    setDocError(null);
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (item: Study) => {
    setEditingItem(item);
    setFormTitle(item.title || '');
    setFormContent(item.content || item.rawContent || '');
    setCoverFile(null);
    setCoverPreviewUrl(item.generatedImgUrl || item.aiImageUrl || item.mediaFile?.driveWebViewLink || '');
    setDocFile(null);
    setDocError(null);
    if (item.documentUrl) {
      setExistingDoc({
        url: item.documentUrl,
        name: item.documentName || 'Documento anexado',
        type: item.documentType || null,
        size: item.documentSize || null,
      });
    } else {
      setExistingDoc(null);
    }
    setErrors({});

    if (item.type === 'Estudo') {
      const detected = extractBibleReference(`${item.title} ${item.content || item.rawContent || ''} ${item.topic || ''}`);
      if (detected) {
        setFormBook(detected.book);
        setFormChapter(detected.chapter);
        setAutoDetected(detected);
      } else {
        const parts = (item.topic || '').split(' ');
        const foundBook = BIBLE_BOOKS.find((b) => b.name.toLowerCase() === parts[0]?.toLowerCase());
        if (foundBook) {
          setFormBook(foundBook.name);
          setFormChapter(parseInt(parts[1], 10) || '');
        } else {
          setFormBook('');
          setFormChapter('');
        }
        setAutoDetected(null);
      }
    }

    setIsModalOpen(true);
  };

  const handleQuickDocumentSelect = (file: File) => {
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    if (!['.pdf', '.docx', '.doc'].includes(ext)) {
      showFeedback('error', 'Formato inválido. Selecione apenas arquivos DOC, DOCX ou PDF.');
      return;
    }
    const cleanTitle = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim();

    setEditingItem(null);
    setFormTitle(cleanTitle);
    setFormContent('');
    setFormBook('');
    setFormChapter('');
    setAutoDetected(null);
    setCoverFile(null);
    setCoverPreviewUrl('');
    setDocFile(file);
    setExistingDoc(null);
    setDocError(null);
    setErrors({});

    if (activeTab === 'estudos') {
      const detected = extractBibleReference(cleanTitle);
      if (detected) {
        setFormBook(detected.book);
        setFormChapter(detected.chapter);
        setAutoDetected(detected);
      }
    }

    setIsModalOpen(true);
    showFeedback('success', `Documento "${file.name}" carregado! Complete e salve.`);
  };

  const uploadCoverImage = async (file: File): Promise<{ url: string; thumbnailUrl: string } | null> => {
    try {
      const res = await uploadImageWithThumbnail(file, 'GALERIA');
      if (res) {
        return { url: res.url, thumbnailUrl: res.thumbnailUrl };
      }
      return null;
    } catch {
      return null;
    }
  };

  const uploadDocumentFile = async (file: File): Promise<{ url: string; name: string; type: string; size: number } | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('category', 'DOCUMENTO');
      const res = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.mediaFile) {
        const url = json.mediaFile.driveWebViewLink || (json.mediaFile.id ? `/api/media/${json.mediaFile.id}` : null);
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const docType = ext === 'pdf' ? 'pdf' : (ext === 'docx' ? 'docx' : (ext === 'doc' ? 'doc' : 'documento'));
        return {
          url: url || '',
          name: file.name,
          type: docType,
          size: file.size,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!formTitle.trim()) {
      newErrors.title = 'O título é obrigatório.';
    }
    if (!formContent.trim() && !docFile && !existingDoc) {
      newErrors.content = 'O texto/mensagem é obrigatório (ou anexe um documento).';
    }

    // Regra estrita para Estudos: Livro e Capítulo são OBRIGATÓRIOS
    if (activeTab === 'estudos') {
      if (!formBook.trim()) {
        newErrors.book = 'Selecione o Livro da Bíblia.';
      }
      if (!formChapter || Number(formChapter) <= 0) {
        newErrors.chapter = 'Defina um Capítulo válido para o estudo.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showFeedback('error', 'Preencha os campos obrigatórios sinalizados.');
      return;
    }

    setIsSaving(true);
    try {
      let finalCoverUrl = coverPreviewUrl;
      let finalThumbUrl = editingItem?.thumbnailUrl || null;
      if (coverFile) {
        const uploadedCover = await uploadCoverImage(coverFile);
        if (uploadedCover) {
          finalCoverUrl = uploadedCover.url;
          finalThumbUrl = uploadedCover.thumbnailUrl;
        }
      }

      let finalDocUrl = existingDoc?.url || null;
      let finalDocName = existingDoc?.name || null;
      let finalDocType = existingDoc?.type || null;
      let finalDocSize = existingDoc?.size || null;

      if (docFile) {
        const uploadedDoc = await uploadDocumentFile(docFile);
        if (uploadedDoc) {
          finalDocUrl = uploadedDoc.url;
          finalDocName = uploadedDoc.name;
          finalDocType = uploadedDoc.type;
          finalDocSize = uploadedDoc.size;
        }
      }

      const contentType = activeTab === 'devocionais' ? 'Devocional' : 'Estudo';
      const textValue = formContent.trim() || (finalDocName ? `Documento anexado: ${finalDocName}` : '');
      const topicValue = activeTab === 'estudos' && formBook && formChapter
        ? `${formBook} ${formChapter}`
        : (editingItem?.topic || 'Geral');

      const payload = {
        title: formTitle.trim(),
        type: contentType,
        status: 'PUBLICADO',
        published: true,
        content: textValue,
        rawContent: textValue,
        summary: textValue.length > 200 ? `${textValue.slice(0, 197)}...` : textValue,
        topic: topicValue,
        generatedImgUrl: finalCoverUrl || null,
        thumbnailUrl: finalThumbUrl || null,
        aiImageUrl: finalCoverUrl || null,
        documentUrl: finalDocUrl,
        documentName: finalDocName,
        documentType: finalDocType,
        documentSize: finalDocSize,
      };

      let res: Response;
      if (editingItem) {
        res = await apiFetch(`/api/estudos/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch('/api/estudos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (json.success) {
        showFeedback('success', editingItem ? 'Item atualizado com sucesso!' : 'Publicado com sucesso!');
        setIsModalOpen(false);
        loadData();
      } else {
        showFeedback('error', json.error || 'Falha ao salvar item.');
      }
    } catch {
      showFeedback('error', 'Erro de conexão ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      const res = await apiFetch(`/api/estudos/${deleteConfirmItem.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showFeedback('success', 'Excluído com sucesso.');
        setDeleteConfirmItem(null);
        loadData();
      } else {
        showFeedback('error', json.error || 'Erro ao excluir.');
      }
    } catch {
      showFeedback('error', 'Erro de conexão ao excluir.');
    }
  };

  // ─── Filtragem de Devocionais ──────────────────────────────────────────────
  const filteredDevocionais = useMemo(() => {
    return devocionais.filter((d) => {
      const q = searchTerm.toLowerCase();
      return (
        (d.title || '').toLowerCase().includes(q) ||
        (d.content || d.rawContent || '').toLowerCase().includes(q)
      );
    });
  }, [devocionais, searchTerm]);

  // Paginação aplicada a Devocionais
  const totalDevocionaisPages = Math.ceil(filteredDevocionais.length / itemsPerPage) || 1;
  const paginatedDevocionais = useMemo(() => {
    const start = (devocionaisPage - 1) * itemsPerPage;
    return filteredDevocionais.slice(start, start + itemsPerPage);
  }, [filteredDevocionais, devocionaisPage, itemsPerPage]);

  // ─── Filtragem e Agrupamento de Estudos por Livro da Bíblia ─────────────────
  const filteredEstudos = useMemo(() => {
    return estudos.filter((e) => {
      const q = searchTerm.toLowerCase();
      return (
        (e.title || '').toLowerCase().includes(q) ||
        (e.content || e.rawContent || '').toLowerCase().includes(q) ||
        (e.topic || '').toLowerCase().includes(q)
      );
    });
  }, [estudos, searchTerm]);

  const groupedEstudos = useMemo(() => {
    const map = new Map<string, Study[]>();

    filteredEstudos.forEach((item) => {
      const detected = extractBibleReference(`${item.title} ${item.content || item.rawContent || ''} ${item.topic || ''}`);
      let bookName = detected?.book;
      if (!bookName && item.topic) {
        const parts = item.topic.split(' ');
        const found = BIBLE_BOOKS.find((b) => b.name.toLowerCase() === parts[0]?.toLowerCase());
        if (found) bookName = found.name;
      }
      if (!bookName) bookName = 'Outros Estudos';

      if (!map.has(bookName)) {
        map.set(bookName, []);
      }
      map.get(bookName)!.push(item);
    });

    const groups: { book: string; bookInfo?: BibleBookInfo; items: Study[] }[] = [];

    BIBLE_BOOKS.forEach((b) => {
      if (map.has(b.name)) {
        const sortedItems = map.get(b.name)!.sort((a, b) => {
          const refA = extractBibleReference(`${a.title} ${a.content || ''} ${a.topic || ''}`);
          const refB = extractBibleReference(`${b.title} ${b.content || ''} ${b.topic || ''}`);
          return (refA?.chapter || 0) - (refB?.chapter || 0);
        });
        groups.push({ book: b.name, bookInfo: b, items: sortedItems });
      }
    });

    if (map.has('Outros Estudos')) {
      groups.push({ book: 'Outros Estudos', items: map.get('Outros Estudos')! });
    }

    return groups;
  }, [filteredEstudos]);

  const toggleBook = (bookName: string) => {
    setExpandedBooks((prev) => ({ ...prev, [bookName]: !prev[bookName] }));
  };

  const expandAllBooks = () => {
    const all: Record<string, boolean> = {};
    groupedEstudos.forEach((g) => { all[g.book] = true; });
    setExpandedBooks(all);
  };

  const collapseAllBooks = () => {
    setExpandedBooks({});
  };

  const selectedBookObj = BIBLE_BOOKS.find((b) => b.name === formBook);
  const chapterOptions = selectedBookObj
    ? Array.from({ length: selectedBookObj.chapters }, (_, i) => i + 1)
    : [];

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium border animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200'
              : 'bg-red-950/80 border-red-600 text-red-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Header Principal com Abas */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#374151]">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Gestão de Conteúdos</span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Painel administrativo para Devocionais diários e Estudos Bíblicos estruturados
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-[#374151] bg-[#111827] text-gray-300 hover:text-white hover:bg-[#1F2937] transition-colors cursor-pointer shrink-0"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={openCreateModal}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{activeTab === 'devocionais' ? 'Novo Devocional' : 'Novo Estudo'}</span>
          </button>
        </div>
      </div>

      {/* Navegação entre Módulos (Abas) */}
      <div className="flex border-b border-[#374151] gap-6">
        <button
          onClick={() => {
            setActiveTab('devocionais');
            setSearchTerm('');
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
            activeTab === 'devocionais'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Devocionais</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-[#1F2937] text-gray-300">
            {devocionais.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('estudos');
            setSearchTerm('');
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
            activeTab === 'estudos'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Estudos Bíblicos</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-[#1F2937] text-gray-300">
            {estudos.length}
          </span>
        </button>
      </div>

      {/* ─── UPLOAD RÁPIDO DE DOCUMENTOS (PDF / DOCX) ─────────────────────────── */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-950/40 via-[#111827] to-[#111827] border-2 border-dashed border-blue-600/40 hover:border-blue-500/80 rounded-2xl transition-all shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Upload Rápido de Documentos
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-900/60 text-blue-300 border border-blue-600/40 uppercase">
                  PDF • DOCX • DOC
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 truncate sm:whitespace-normal">
                Clique para selecionar ou arraste um arquivo para criar um novo {activeTab === 'devocionais' ? 'Devocional' : 'Estudo Bíblico'} com título e visor automático.
              </p>
            </div>
          </div>

          <label className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-md shrink-0">
            <FileText className="w-4 h-4" />
            <span>Selecionar Documento</span>
            <input
              type="file"
              accept=".pdf,.docx,.doc,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleQuickDocumentSelect(file);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Barra de Busca e Ferramentas */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={activeTab === 'devocionais' ? 'Buscar devocionais por título ou mensagem...' : 'Buscar estudos bíblicos por livro, capítulo ou palavra-chave...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-[#111827] border border-[#374151] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {activeTab === 'estudos' && groupedEstudos.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={expandAllBooks}
              className="px-3 py-2 bg-[#111827] hover:bg-[#1F2937] border border-[#374151] text-xs font-medium text-gray-300 rounded-lg transition-colors cursor-pointer"
            >
              Expandir Todos
            </button>
            <button
              onClick={collapseAllBooks}
              className="px-3 py-2 bg-[#111827] hover:bg-[#1F2937] border border-[#374151] text-xs font-medium text-gray-300 rounded-lg transition-colors cursor-pointer"
            >
              Recolher Todos
            </button>
          </div>
        )}
      </div>

      {/* ─── 1. MÓDULO: DEVOCIONAIS (TABELA ADMINISTRATIVA COM PAGINAÇÃO) ─────── */}
      {activeTab === 'devocionais' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <span>Carregando devocionais...</span>
            </div>
          ) : filteredDevocionais.length === 0 ? (
            <div className="py-16 text-center bg-[#111827] border border-[#374151] rounded-2xl p-8">
              <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-300 font-semibold text-lg">Nenhum devocional encontrado</p>
              <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
                {searchTerm ? 'Nenhum resultado para os termos pesquisados.' : 'Clique em "Novo Devocional" acima para cadastrar seu primeiro devocional com capa.'}
              </p>
            </div>
          ) : (
            <div className="bg-[#111827] border border-[#374151] rounded-2xl overflow-hidden shadow-xl">
              {/* Visualização em CARDS para Mobile (evita quebra de layout) */}
              <div className="block md:hidden p-3 space-y-3 bg-[#0A0F1A]/60">
                {paginatedDevocionais.map((item) => {
                  const cover = item.thumbnailUrl
                    || (item.generatedImgUrl?.includes('/api/media/') ? `${item.generatedImgUrl}?variant=thumbnail` : item.generatedImgUrl)
                    || item.aiImageUrl
                    || item.mediaFile?.driveWebViewLink;
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 bg-[#111827] border border-[#374151] rounded-xl flex flex-col justify-between gap-3 group"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {cover ? (
                          <img
                            src={cover}
                            alt={item.title}
                            loading="lazy"
                            decoding="async"
                            className="w-16 h-16 rounded-xl object-cover border border-[#374151] shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-950/60 to-purple-950/60 border border-[#374151] flex items-center justify-center text-indigo-400 shrink-0">
                            <BookOpen className="w-6 h-6 opacity-60" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-[11px] text-gray-400">
                              📅 {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                            {item.documentUrl && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 font-bold text-[10px] border border-blue-700/50 flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {(item.documentType || 'DOC').toUpperCase()}
                              </span>
                            )}
                          </div>

                          <h4 className="font-semibold text-white text-sm group-hover:text-blue-400 transition-colors line-clamp-1">
                            {item.title}
                          </h4>
                          <p className="text-xs text-gray-400 line-clamp-2 mt-0.5 leading-relaxed">
                            {item.content || item.rawContent}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#1F2937] text-xs">
                        <span className="text-[11px] text-gray-500 font-mono">
                          ID: {item.id.slice(0, 8)}...
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewingItem(item)}
                            className="p-1.5 px-2.5 rounded-lg text-gray-300 hover:text-white bg-[#1F2937] hover:bg-[#374151] transition-colors cursor-pointer flex items-center gap-1"
                            title="Visualizar"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver</span>
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 px-2.5 rounded-lg text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/40 transition-colors cursor-pointer flex items-center gap-1"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => setDeleteConfirmItem(item)}
                            className="p-1.5 px-2.5 rounded-lg text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 transition-colors cursor-pointer flex items-center gap-1"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Visualização em TABELA para Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#374151] bg-[#0A0F1A]/80 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-20">Capa</th>
                      <th className="py-3.5 px-4 min-w-[200px]">Título</th>
                      <th className="py-3.5 px-4 w-28">Documento</th>
                      <th className="py-3.5 px-4 min-w-[300px]">Texto / Mensagem</th>
                      <th className="py-3.5 px-4 w-32">Data</th>
                      <th className="py-3.5 px-4 w-32 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2937] text-sm">
                    {paginatedDevocionais.map((item) => {
                      const cover = item.thumbnailUrl
                        || (item.generatedImgUrl?.includes('/api/media/') ? `${item.generatedImgUrl}?variant=thumbnail` : item.generatedImgUrl)
                        || item.aiImageUrl
                        || item.mediaFile?.driveWebViewLink;
                      return (
                        <tr key={item.id} className="hover:bg-[#1F2937]/50 transition-colors group">
                          {/* Capa */}
                          <td className="py-3 px-4">
                            {cover ? (
                              <img
                                src={cover}
                                alt={item.title}
                                loading="lazy"
                                decoding="async"
                                className="w-12 h-12 rounded-lg object-cover border border-[#374151]"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-950/60 to-purple-950/60 border border-[#374151] flex items-center justify-center text-indigo-400">
                                <ImageIcon className="w-5 h-5 opacity-60" />
                              </div>
                            )}
                          </td>

                          {/* Título */}
                          <td className="py-3 px-4">
                            <span className="font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-gray-500 font-mono">
                              ID: {item.id.slice(0, 12)}...
                            </span>
                          </td>

                          {/* Documento */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {item.documentUrl ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
                                <FileText className="w-3 h-3" />
                                {(item.documentType || 'DOC').toUpperCase()}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-600">—</span>
                            )}
                          </td>

                          {/* Mensagem */}
                          <td className="py-3 px-4">
                            <p className="text-gray-300 text-xs line-clamp-2 leading-relaxed">
                              {item.content || item.rawContent}
                            </p>
                          </td>

                          {/* Data */}
                          <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-400">
                            {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                          </td>

                          {/* Ações */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setViewingItem(item)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1F2937] transition-colors cursor-pointer"
                                title="Visualizar devocional"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEditModal(item)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-[#1F2937] transition-colors cursor-pointer"
                                title="Editar devocional"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmItem(item)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-[#1F2937] transition-colors cursor-pointer"
                                title="Excluir devocional"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Barra de Paginação */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 bg-[#0A0F1A]/80 border-t border-[#374151] text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <span>
                    Mostrando{' '}
                    <strong>
                      {filteredDevocionais.length === 0
                        ? 0
                        : (devocionaisPage - 1) * itemsPerPage + 1}
                    </strong>{' '}
                    a{' '}
                    <strong>
                      {Math.min(devocionaisPage * itemsPerPage, filteredDevocionais.length)}
                    </strong>{' '}
                    de <strong>{filteredDevocionais.length}</strong> devocionais
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setDevocionaisPage((p) => Math.max(p - 1, 1))}
                    disabled={devocionaisPage === 1}
                    className="p-1.5 rounded-lg border border-[#374151] bg-[#111827] text-gray-300 hover:bg-[#1F2937] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Página Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalDevocionaisPages }, (_, idx) => idx + 1)
                    .filter((p) => p === 1 || p === totalDevocionaisPages || Math.abs(p - devocionaisPage) <= 1)
                    .map((p, i, arr) => {
                      const prev = arr[i - 1];
                      return (
                        <React.Fragment key={p}>
                          {prev && p - prev > 1 && <span className="px-1 text-gray-600">...</span>}
                          <button
                            onClick={() => setDevocionaisPage(p)}
                            className={`min-w-[32px] h-8 px-2 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                              devocionaisPage === p
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-[#111827] border border-[#374151] text-gray-300 hover:bg-[#1F2937]'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  <button
                    onClick={() => setDevocionaisPage((p) => Math.min(p + 1, totalDevocionaisPages))}
                    disabled={devocionaisPage === totalDevocionaisPages}
                    className="p-1.5 rounded-lg border border-[#374151] bg-[#111827] text-gray-300 hover:bg-[#1F2937] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Próxima Página"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 2. MÓDULO: ESTUDOS BÍBLICOS (AGRUPADOS POR LIVRO DA BÍBLIA) ───────── */}
      {activeTab === 'estudos' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <span>Carregando estudos bíblicos...</span>
            </div>
          ) : groupedEstudos.length === 0 ? (
            <div className="py-16 text-center bg-[#111827] border border-[#374151] rounded-2xl p-8">
              <GraduationCap className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-300 font-semibold text-lg">Nenhum estudo bíblico encontrado</p>
              <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
                {searchTerm ? 'Nenhum estudo corresponde à busca.' : 'Clique no botão "Novo Estudo" acima para cadastrar estudos com detecção automática de livro e capítulo.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedEstudos.map((group) => {
                const isExpanded = expandedBooks[group.book] ?? true; // padrão expandido
                return (
                  <div
                    key={group.book}
                    className="bg-[#111827] border border-[#374151] rounded-2xl overflow-hidden shadow-md transition-all"
                  >
                    {/* Cabeçalho do Acordeão */}
                    <button
                      type="button"
                      onClick={() => toggleBook(group.book)}
                      className="w-full flex items-center justify-between px-5 py-4 bg-[#0A0F1A]/70 hover:bg-[#1F2937]/50 transition-colors text-left cursor-pointer border-b border-[#374151]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-900/40 border border-blue-700/50 flex items-center justify-center text-blue-400">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-white tracking-wide">
                              {group.book}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60">
                              {group.items.length} {group.items.length === 1 ? 'estudo' : 'estudos'}
                            </span>
                          </div>
                          {group.bookInfo && (
                            <span className="text-[11px] text-gray-500">
                              {group.bookInfo.chapters} capítulos no total
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-gray-400">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-blue-400 transition-transform" />
                        ) : (
                          <ChevronRight className="w-5 h-5 transition-transform" />
                        )}
                      </div>
                    </button>

                    {/* Conteúdo do Acordeão em Cards Responsivos */}
                    {isExpanded && (
                      <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#0A0F1A]/40">
                        {group.items.map((item) => {
                          const ref = extractBibleReference(`${item.title} ${item.content || item.rawContent || ''} ${item.topic || ''}`);
                          const capLabel = ref ? `Capítulo ${ref.chapter}` : (item.topic || 'Geral');
                          const cover = item.thumbnailUrl
                            || (item.generatedImgUrl?.includes('/api/media/') ? `${item.generatedImgUrl}?variant=thumbnail` : item.generatedImgUrl)
                            || item.aiImageUrl
                            || item.mediaFile?.driveWebViewLink;

                          return (
                            <div
                              key={item.id}
                              className="p-3.5 bg-[#111827] border border-[#374151] rounded-xl hover:border-blue-500/50 transition-colors flex flex-col justify-between gap-3 group"
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                {cover ? (
                                  <img
                                    src={cover}
                                    alt={item.title}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-14 h-14 rounded-xl object-cover border border-[#374151] shrink-0"
                                  />
                                ) : (
                                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-950/60 to-cyan-950/60 border border-[#374151] flex items-center justify-center text-blue-400 shrink-0">
                                    <GraduationCap className="w-6 h-6 opacity-60" />
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                    <span className="px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 font-bold text-[11px] border border-blue-700/50">
                                      📖 {capLabel}
                                    </span>
                                    {item.documentUrl && (
                                      <span className="px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 font-bold text-[10px] border border-indigo-700/50 flex items-center gap-1">
                                        <FileText className="w-3 h-3" />
                                        {(item.documentType || 'DOC').toUpperCase()}
                                      </span>
                                    )}
                                    <span className="text-[11px] text-gray-500">
                                      {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>

                                  <h4 className="font-semibold text-white text-sm group-hover:text-blue-400 transition-colors truncate">
                                    {item.title}
                                  </h4>
                                  <p className="text-xs text-gray-400 line-clamp-2 mt-1">
                                    {item.content || item.rawContent}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[#1F2937]">
                                <button
                                  onClick={() => setViewingItem(item)}
                                  className="p-1.5 px-2.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-[#1F2937] hover:bg-[#374151] transition-colors cursor-pointer flex items-center gap-1"
                                  title="Visualizar estudo"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Ver</span>
                                </button>
                                <button
                                  onClick={() => openEditModal(item)}
                                  className="p-1.5 px-2.5 rounded-lg text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/40 transition-colors cursor-pointer flex items-center gap-1"
                                  title="Editar estudo"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Editar</span>
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmItem(item)}
                                  className="p-1.5 px-2.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 transition-colors cursor-pointer flex items-center gap-1"
                                  title="Excluir estudo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Excluir</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL DE CADASTRO / EDIÇÃO ────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#111827] border border-[#374151] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#374151] bg-[#0A0F1A]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {activeTab === 'devocionais' ? (
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                ) : (
                  <GraduationCap className="w-5 h-5 text-blue-400" />
                )}
                <span>
                  {editingItem ? 'Editar' : 'Novo'}{' '}
                  {activeTab === 'devocionais' ? 'Devocional' : 'Estudo Bíblico'}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1F2937] transition-colors"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Upload de Documento (DOC, DOCX, PDF) - Topo do Formulário */}
              <div className="p-4 bg-[#0A0F1A]/90 border-2 border-dashed border-[#374151] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>Upload de Documento (DOC, DOCX, PDF)</span>
                  </label>
                  <span className="text-[11px] font-medium text-gray-400">
                    Opcional • Preenche título automaticamente
                  </span>
                </div>

                {/* Arquivo selecionado agora ou previamente anexado */}
                {docFile || existingDoc ? (
                  <div className="flex items-center justify-between p-3 bg-[#1F2937]/90 border border-blue-600/40 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-900/40 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 font-bold text-xs uppercase">
                        {(docFile ? docFile.name.split('.').pop() : existingDoc?.type || existingDoc?.name.split('.').pop()) || 'DOC'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {docFile ? docFile.name : existingDoc?.name}
                        </p>
                        <p className="text-[11px] text-gray-400 flex items-center gap-2">
                          <span>
                            {docFile
                              ? `${(docFile.size / 1024 / 1024).toFixed(2)} MB`
                              : existingDoc?.size
                              ? `${(existingDoc.size / 1024 / 1024).toFixed(2)} MB`
                              : 'Arquivo anexado'}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-400 font-medium">
                            {docFile ? 'Novo arquivo pronto para upload' : 'Documento anexado atualmente'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {existingDoc && !docFile && (
                        <a
                          href={existingDoc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-[#111827] transition-colors"
                          title="Visualizar documento atual"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setDocFile(null);
                          setExistingDoc(null);
                          setDocError(null);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-[#111827] transition-colors cursor-pointer"
                        title="Remover documento"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-blue-500/40 hover:border-blue-400 rounded-xl bg-[#111827] cursor-pointer transition-all text-center group">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-950/80 border border-blue-800/50 text-blue-400 mb-2.5 group-hover:scale-105 transition-transform shadow-inner">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <span className="text-sm text-white font-semibold">
                      Arraste ou selecione um documento
                    </span>
                    <span className="text-xs text-gray-400 mt-1">
                      Formatos aceitos: <strong className="text-blue-300">.PDF</strong>, <strong className="text-indigo-300">.DOCX</strong>, <strong className="text-sky-300">.DOC</strong>
                    </span>
                    <span className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 group-hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Procurar Documento no Computador</span>
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onClick={(e) => {
                        (e.target as HTMLInputElement).value = '';
                      }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
                          if (!['.pdf', '.docx', '.doc'].includes(ext)) {
                            setDocError('Formato inválido. Selecione apenas arquivos DOC, DOCX ou PDF.');
                            return;
                          }
                          setDocError(null);
                          setDocFile(file);
                          if (!formTitle.trim()) {
                            const cleanTitle = file.name
                              .replace(/\.[^.]+$/, '')
                              .replace(/[_-]+/g, ' ')
                              .trim();
                            if (cleanTitle) {
                              setFormTitle(cleanTitle);
                              if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                            }
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                )}

                {docError && <p className="text-xs text-red-400 mt-1">{docError}</p>}
              </div>

              {/* Título */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Título *
                </label>
                <input
                  type="text"
                  placeholder={
                    activeTab === 'devocionais'
                      ? 'Ex: Confiança em Meio às Tempestades'
                      : 'Ex: A Fidelidade de Deus (Romanos 8)'
                  }
                  value={formTitle}
                  onChange={(e) => {
                    setFormTitle(e.target.value);
                    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  className={`w-full px-4 py-2.5 bg-[#1F2937] border rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none transition-colors ${
                    errors.title ? 'border-red-500 focus:border-red-500' : 'border-[#374151] focus:border-blue-500'
                  }`}
                />
                {errors.title && <p className="text-xs text-red-400 mt-1">{errors.title}</p>}
              </div>

              {/* Se for Estudo Bíblico: Detecção Automática e Seleção Obrigatória */}
              {activeTab === 'estudos' && (
                <div className="p-4 bg-[#0A0F1A] border border-[#374151] rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      Referência Bíblica (Obrigatório)
                    </span>

                    {autoDetected ? (
                      <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-md border border-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        Detectado no texto: {autoDetected.book} {autoDetected.chapter}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-amber-400 bg-amber-950/80 px-2.5 py-1 rounded-md border border-amber-800 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        Não detectado no texto — Selecione abaixo:
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1 font-medium">
                        Livro da Bíblia *
                      </label>
                      <select
                        value={formBook}
                        onChange={(e) => {
                          setFormBook(e.target.value);
                          setFormChapter('');
                          if (errors.book) setErrors((prev) => ({ ...prev, book: undefined }));
                        }}
                        className={`w-full px-3 py-2 bg-[#1F2937] border rounded-lg text-sm text-white focus:outline-none transition-colors ${
                          errors.book ? 'border-red-500' : 'border-[#374151] focus:border-blue-500'
                        }`}
                      >
                        <option value="">Selecione o livro...</option>
                        {BIBLE_BOOKS.map((b) => (
                          <option key={b.name} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      {errors.book && <p className="text-xs text-red-400 mt-1">{errors.book}</p>}
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1 font-medium">
                        Capítulo *
                      </label>
                      <select
                        disabled={!formBook}
                        value={formChapter}
                        onChange={(e) => {
                          setFormChapter(Number(e.target.value));
                          if (errors.chapter) setErrors((prev) => ({ ...prev, chapter: undefined }));
                        }}
                        className={`w-full px-3 py-2 bg-[#1F2937] border rounded-lg text-sm text-white focus:outline-none transition-colors disabled:opacity-50 ${
                          errors.chapter ? 'border-red-500' : 'border-[#374151] focus:border-blue-500'
                        }`}
                      >
                        <option value="">Selecione o capítulo...</option>
                        {chapterOptions.map((ch) => (
                          <option key={ch} value={ch}>
                            Capítulo {ch}
                          </option>
                        ))}
                      </select>
                      {errors.chapter && <p className="text-xs text-red-400 mt-1">{errors.chapter}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Texto / Conteúdo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    {activeTab === 'devocionais' ? 'Texto / Mensagem *' : 'Conteúdo do Estudo Bíblico *'}
                  </label>
                  <span className="text-[11px] text-gray-500">
                    {formContent.length} caracteres
                  </span>
                </div>
                <textarea
                  rows={activeTab === 'devocionais' ? 6 : 8}
                  placeholder={
                    activeTab === 'devocionais'
                      ? 'Escreva a mensagem diária ou reflexão do devocional...'
                      : 'Cole ou digite o texto completo do estudo. O sistema tentará detectar referências como "João 3", "Gn 1", "Romanos 8"...'
                  }
                  value={formContent}
                  onChange={(e) => {
                    setFormContent(e.target.value);
                    if (errors.content) setErrors((prev) => ({ ...prev, content: undefined }));
                  }}
                  className={`w-full px-4 py-3 bg-[#1F2937] border rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none leading-relaxed transition-colors ${
                    errors.content ? 'border-red-500' : 'border-[#374151] focus:border-blue-500'
                  }`}
                />
                {errors.content && <p className="text-xs text-red-400 mt-1">{errors.content}</p>}
              </div>

              {/* Capa (Upload Exclusivo para Imagens) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Imagem de Capa (Upload Exclusivo de Imagem)
                </label>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {coverPreviewUrl && (
                    <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-black/50 border border-[#374151] shrink-0 group">
                      <img src={coverPreviewUrl} alt="Preview da Capa" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setCoverFile(null);
                          setCoverPreviewUrl('');
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-500 text-white rounded-md shadow transition-colors cursor-pointer"
                        title="Remover capa"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <label className="flex-1 w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#374151] hover:border-blue-500 rounded-xl bg-[#0A0F1A] cursor-pointer transition-colors text-center">
                    <UploadCloud className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-300 font-medium">
                      {coverFile ? coverFile.name : 'Clique para selecionar a imagem de capa'}
                    </span>
                    <span className="text-[11px] text-gray-400 mt-0.5">
                      Aceita JPG, PNG, WebP • Gera miniatura leve de 500px para cards mobile
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (!file.type.startsWith('image/')) {
                            setErrors((prev) => ({
                              ...prev,
                              cover: 'Arquivo inválido. Selecione apenas imagens.',
                            }));
                            return;
                          }
                          setErrors((prev) => ({ ...prev, cover: undefined }));
                          setCoverFile(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                {errors.cover && <p className="text-xs text-red-400 mt-1">{errors.cover}</p>}
              </div>

              {/* Botões do Modal */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#374151]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#374151] text-sm text-gray-300 hover:bg-[#1F2937] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition-all cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  {isSaving ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Publicar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL DE VISUALIZAÇÃO ────────────────────────────────────────────── */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#111827] border border-[#374151] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#374151] bg-[#0A0F1A]">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                {viewingItem.type}
              </span>
              <button
                onClick={() => setViewingItem(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1F2937] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {(viewingItem.generatedImgUrl || viewingItem.aiImageUrl || viewingItem.mediaFile?.driveWebViewLink) && (
                <div className="h-60 w-full rounded-xl overflow-hidden bg-black/40 border border-[#374151]">
                  <img
                    src={viewingItem.generatedImgUrl || viewingItem.aiImageUrl || viewingItem.mediaFile?.driveWebViewLink}
                    alt={viewingItem.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <h2 className="text-xl font-bold text-white">{viewingItem.title}</h2>
              {viewingItem.topic && (
                <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">
                  📖 {viewingItem.topic}
                </span>
              )}

              {/* Documento Anexado */}
              {viewingItem.documentUrl && (
                <div className="p-4 bg-[#0A0F1A] border border-blue-600/40 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-900/50 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 font-bold text-xs uppercase">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {viewingItem.documentName || 'Documento Anexado'}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {(viewingItem.documentType || 'DOCUMENTO').toUpperCase()}
                        {viewingItem.documentSize ? ` • ${(viewingItem.documentSize / 1024 / 1024).toFixed(2)} MB` : ''}
                      </p>
                    </div>
                  </div>
                  <a
                    href={viewingItem.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar / Abrir</span>
                  </a>
                </div>
              )}

              <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap pt-2 border-t border-[#1F2937]">
                {viewingItem.content || viewingItem.rawContent}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ─────────────────────────────────── */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111827] border border-[#374151] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              <span>Confirmar Exclusão</span>
            </h3>
            <p className="text-sm text-gray-300">
              Tem certeza que deseja excluir o {deleteConfirmItem.type.toLowerCase()}{' '}
              <strong>"{deleteConfirmItem.title}"</strong>? Esta ação removerá o conteúdo do aplicativo.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 rounded-xl border border-[#374151] text-sm text-gray-300 hover:bg-[#1F2937] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors cursor-pointer"
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
