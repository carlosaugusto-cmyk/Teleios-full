import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Video,
  Image as ImageIcon,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ContentCategory } from '../../../types/index.ts';
import { apiFetch } from '../../../services/api.service.ts';

interface IngestStudioProps {
  onUploadSuccess: () => void;
  onNavigateToEstudos: () => void;
}

export const IngestStudio: React.FC<IngestStudioProps> = ({
  onUploadSuccess,
  onNavigateToEstudos,
}) => {
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [category, setCategory] = useState<ContentCategory>(ContentCategory.ESTUDO);
  const [textContent, setTextContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [videoDescription, setVideoDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFileName(file.name);

      if (file.type.startsWith('video/')) {
        setCategory(ContentCategory.VIDEO);
        setVideoTitle(file.name.replace(/\.[^/.]+$/, ''));
      } else if (file.type.startsWith('image/')) {
        setCategory(ContentCategory.GALERIA);
      } else if (file.name.endsWith('.pdf') || file.name.endsWith('.doc') || file.name.endsWith('.docx') || file.name.endsWith('.txt')) {
        setCategory(ContentCategory.ESTUDO);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setFileName(file.name);
      setMode('file');

      if (file.type.startsWith('video/')) setCategory(ContentCategory.VIDEO);
      else if (file.type.startsWith('image/')) setCategory(ContentCategory.GALERIA);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('scheduleTime', 'immediate'); // Simplify, default to immediate
      formData.append('recipient', '5511999998888');

      if (mode === 'file' && selectedFile) {
        formData.append('file', selectedFile);
        formData.append('fileName', selectedFile.name);
        formData.append('mimeType', selectedFile.type || 'application/octet-stream');
      } else {
        formData.append('textContent', textContent);
        formData.append('fileName', fileName || 'novo_texto.txt');
        formData.append('mimeType', 'text/plain');
      }

      if (category === ContentCategory.VIDEO) {
        formData.append('videoTitle', videoTitle);
        formData.append('videoDescription', videoDescription);
      }

      const response = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const responseText = await response.text();
      let data: { success?: boolean; error?: string };
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(`A API retornou uma resposta inválida (HTTP ${response.status}). Confirme que o servidor está em execução.`);
      }

      if (response.ok && data.success) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
        setStatusMessage({ type: 'success', text: 'Publicado com sucesso!' });
        setTextContent('');
        setFileName('');
        setSelectedFile(null);
        setVideoTitle('');
        setVideoDescription('');
        onUploadSuccess();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Erro ao processar publicação.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Falha na comunicação com o servidor.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: ContentCategory.ESTUDO, label: 'Estudo', icon: FileText },
    { id: ContentCategory.GALERIA, label: 'Galeria', icon: ImageIcon },
    { id: ContentCategory.VIDEO, label: 'Vídeo', icon: Video },
    { id: ContentCategory.PROJETO, label: 'Projeto', icon: FolderKanban },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[#111827] border border-[#374151] rounded-xl p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-[#F9FAFB] mb-6">Nova Publicação</h2>
        
        {/* Category Selector */}
        <div className="flex flex-wrap gap-3 mb-8">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                  isSelected
                    ? 'bg-[#0077C8] text-white border-transparent'
                    : 'bg-[#1F2937] text-[#9CA3AF] border border-[#374151] hover:text-[#F9FAFB]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Input Mode */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('text')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg ${
              mode === 'text' ? 'bg-[#374151] text-white' : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            Escrever Texto
          </button>
          <button
            onClick={() => setMode('file')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg ${
              mode === 'file' ? 'bg-[#374151] text-white' : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            Enviar Arquivo
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === 'text' ? (
            <div className="space-y-4">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Título do documento (opcional)"
                className="w-full bg-[#1F2937] border border-[#374151] px-4 py-3 text-sm text-white rounded-lg focus:outline-none focus:border-[#0077C8]"
              />
              <textarea
                rows={8}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Cole ou digite o conteúdo aqui..."
                className="w-full bg-[#1F2937] border border-[#374151] px-4 py-3 text-sm text-white rounded-lg focus:outline-none focus:border-[#0077C8]"
                required
              />
            </div>
          ) : (
            <div className="space-y-4">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-[#374151] hover:border-[#0077C8] bg-[#1F2937] p-10 text-center rounded-xl cursor-pointer transition flex flex-col items-center justify-center gap-3"
              >
                <UploadCloud className="w-8 h-8 text-[#9CA3AF]" />
                {selectedFile ? (
                  <div>
                    <p className="font-semibold text-white">{selectedFile.name}</p>
                    <p className="text-sm text-[#9CA3AF] mt-1">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <p className="text-[#9CA3AF] font-medium">Clique ou arraste o arquivo aqui</p>
                )}
              </div>
            </div>
          )}

          {/* YouTube Video Specific Fields */}
          {category === ContentCategory.VIDEO && (
            <div className="space-y-4 pt-4 border-t border-[#374151]">
              <h3 className="font-semibold text-white">Detalhes do Vídeo</h3>
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="Título"
                className="w-full bg-[#1F2937] border border-[#374151] px-4 py-3 text-sm text-white rounded-lg focus:outline-none focus:border-[#0077C8]"
              />
              <textarea
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
                placeholder="Descrição"
                rows={3}
                className="w-full bg-[#1F2937] border border-[#374151] px-4 py-3 text-sm text-white rounded-lg focus:outline-none focus:border-[#0077C8]"
              />
            </div>
          )}

          {/* Feedback */}
          {statusMessage && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${statusMessage.type === 'success' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
              <div className="flex-1">
                <p className="font-medium">{statusMessage.text}</p>
                {statusMessage.type === 'success' && category === ContentCategory.ESTUDO && (
                  <button type="button" onClick={onNavigateToEstudos} className="mt-2 text-sm font-semibold underline hover:text-emerald-300">
                    Ir para Estudos
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || (mode === 'text' && !textContent) || (mode === 'file' && !selectedFile)}
              className="px-6 py-3 bg-[#0077C8] hover:bg-[#005F9E] disabled:bg-[#374151] disabled:text-[#9CA3AF] text-white font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Publicar Conteúdo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
