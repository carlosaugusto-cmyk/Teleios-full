import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Send,
  Image as ImageIcon,
  Music,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  MessageCircle,
  Sparkles,
  X,
  ChevronDown,
  Phone,
  Zap,
  Search,
  Users,
  SendHorizontal,
  Upload,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Study, MediaFile, Devocional } from '../../types/index.ts';
import { getStudyTitle, getStudyPreviewText } from '../../utils/contentSanitizer.ts';
import { DESTINATIONS } from '../../config/destinations.ts';
import {
  WaDestination,
  getSavedChannels,
  saveChannels,
  fetchLiveWhatsAppGroups,
  sendWhatsAppDirectMessage,
  getGlobalWhatsAppChannel,
  GLOBAL_CHANNEL_CHANGE_EVENT,
} from '../../services/whatsappChannels.service.ts';

interface DevocionaisViewProps {
  studies: Study[];
  galeriaFiles: MediaFile[];
  onRefresh: () => void;
}

export const DevocionaisView: React.FC<DevocionaisViewProps> = ({
  studies,
  galeriaFiles,
  onRefresh,
}) => {
  const [devocionais, setDevocionais] = useState<Devocional[]>(() => {
    try {
      const saved = localStorage.getItem('teleios_devocionais');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'dev-001',
        title: 'Maturidade & Edificação em Cristo',
        textContent:
          'Bom dia amados! Hoje refletimos em Efésios 4:13: "Até que todos alcancemos a medida da estatura da plenitude de Cristo." Que o seu dia seja repleto da presença do Senhor.',
        imageUrl: null,
        audioName: null,
        channelName: 'Número Padrão da Plataforma',
        targetPhone: DESTINATIONS.whatsapp.defaultRecipient,
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledTime: '07:00',
        status: 'DISPARADO',
        createdAt: new Date().toISOString(),
      },
    ];
  });

  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedStudyId, setSelectedStudyId] = useState('');
  const [selectedImage, setSelectedImage] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioName, setAudioName] = useState('');
  const [waChannels, setWaChannels] = useState<WaDestination[]>(getSavedChannels);
  const [globalChannel, setGlobalChannel] = useState<WaDestination | null>(() => getGlobalWhatsAppChannel());
  const [selectedChannelId, setSelectedChannelId] = useState(() => getGlobalWhatsAppChannel()?.jid || getSavedChannels()[0]?.id || '');
  const [customPhone, setCustomPhone] = useState('');
  const [useCustomPhone, setUseCustomPhone] = useState(false);

  // Sincroniza em tempo real com alterações no canal global
  useEffect(() => {
    const handleGlobalUpdate = (e: any) => {
      const updated = e.detail || getGlobalWhatsAppChannel();
      setGlobalChannel(updated);
      setWaChannels(getSavedChannels());
      if (updated?.jid) {
        setSelectedChannelId(updated.jid);
      }
    };
    window.addEventListener(GLOBAL_CHANNEL_CHANGE_EVENT, handleGlobalUpdate);
    return () => window.removeEventListener(GLOBAL_CHANNEL_CHANGE_EVENT, handleGlobalUpdate);
  }, []);

  // Modo de Envio: 'immediate' (Agora) vs 'scheduled' (Agendado)
  const [dispatchMode, setDispatchMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState(() => {
    const now = new Date(Date.now() + 5 * 60 * 1000);
    return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  // Busca ao vivo de grupos
  const [isSearchingGroups, setIsSearchingGroups] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('teleios_devocionais', JSON.stringify(devocionais));
  }, [devocionais]);

  useEffect(() => {
    if (isCreating) {
      const fresh = getSavedChannels();
      setWaChannels(fresh);
      const curGlobal = getGlobalWhatsAppChannel();
      if (curGlobal) {
        setSelectedChannelId(curGlobal.jid || curGlobal.id);
      } else if (!fresh.find((c) => c.id === selectedChannelId || c.jid === selectedChannelId)) {
        setSelectedChannelId(fresh[0]?.id || '');
      }
    }
  }, [isCreating]);

  // ─── AGENDADOR EM TEMPO REAL (RODA A CADA 10 SEGUNDOS) ───────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      const saved = localStorage.getItem('teleios_devocionais');
      if (!saved) return;

      let currentDevs: Devocional[] = [];
      try {
        currentDevs = JSON.parse(saved);
      } catch {
        return;
      }

      const now = new Date();

      for (const dev of currentDevs) {
        if (dev.status === 'PENDENTE' && dev.scheduledDate && dev.scheduledTime) {
          const [year, month, day] = dev.scheduledDate.split('-').map(Number);
          const [hour, minute] = dev.scheduledTime.split(':').map(Number);
          const scheduledTimestamp = new Date(year, month - 1, day, hour, minute, 0).getTime();

          if (now.getTime() >= scheduledTimestamp) {
            console.log(`[Agendador] Disparando devocional agendado: ${dev.title}`);
            const fullMessage = `*${dev.title.trim()}*\n\n${dev.textContent.trim()}`;
            const globalChan = getGlobalWhatsAppChannel();
            const target = dev.targetPhone || globalChan?.jid || DESTINATIONS.whatsapp.defaultChannelId || DESTINATIONS.whatsapp.defaultRecipient;

            const res = await sendWhatsAppDirectMessage({
              recipient: target,
              text: fullMessage,
              imageUrl: dev.imageUrl,
              audioUrl: dev.audioUrl,
            });

            if (res.success) {
              dev.status = 'DISPARADO';
              confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
              setFeedback({
                type: 'success',
                text: `⏰ Devocional agendado "${dev.title}" foi DISPARADO automaticamente via WhatsApp!`,
              });
            } else {
              console.error(`[Agendador] Erro no disparo do devocional ${dev.title}:`, res.error);
            }

            const updated = [...currentDevs];
            setDevocionais(updated);
            localStorage.setItem('teleios_devocionais', JSON.stringify(updated));
          }
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleFetchLiveGroups = async () => {
    setIsSearchingGroups(true);
    setSearchFeedback(null);
    const res = await fetchLiveWhatsAppGroups();
    setIsSearchingGroups(false);

    if (res.success && res.data.length > 0) {
      const existingJids = new Set(waChannels.map((c) => c.jid));
      const newItems = res.data.filter((item) => !existingJids.has(item.jid));
      const merged = [...waChannels, ...newItems];
      setWaChannels(merged);
      saveChannels(merged);
      setSearchFeedback(`✅ ${res.data.length} grupos/canais carregados do WhatsApp!`);
      if (newItems.length > 0) {
        setSelectedChannelId(newItems[0].id);
      }
    } else {
      setSearchFeedback(
        res.error || 'Nenhum grupo encontrado. Verifique se o Agent Go está rodando e conectado ao WhatsApp.'
      );
    }
  };

  const handleStudySelection = (studyId: string) => {
    setSelectedStudyId(studyId);
    if (!studyId) return;
    const study = studies.find((s) => s.id === studyId);
    if (study) {
      if (!title) setTitle(getStudyTitle(study));
      const preview = getStudyPreviewText(study);
      if (preview && !preview.startsWith('[Documento')) {
        setTextContent(preview);
      }
      if (study.generatedImgUrl || study.aiImageUrl) {
        setSelectedImage(study.generatedImgUrl || study.aiImageUrl || '');
      }
    }
  };

  // Upload local de imagem para Base64
  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  // Upload local de áudio para Base64
  const handleLocalAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setAudioUrl(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setTitle('');
    setTextContent('');
    setSelectedStudyId('');
    setSelectedImage('');
    setAudioUrl('');
    setAudioName('');
    const fresh = getSavedChannels();
    setSelectedChannelId(fresh[0]?.id || '');
    setCustomPhone('');
    setUseCustomPhone(false);
    setDispatchMode('immediate');
    setScheduledDate(new Date().toISOString().split('T')[0]);
    setScheduledTime(() => {
      const now = new Date(Date.now() + 5 * 60 * 1000);
      return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    });
    setSearchFeedback(null);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !textContent.trim()) {
      setFeedback({ type: 'error', text: 'Por favor, informe o título e o texto da mensagem.' });
      return;
    }

    setIsSubmitting(true);

    const globalChan = getGlobalWhatsAppChannel();
    const selectedChan = waChannels.find((c) => c.id === selectedChannelId || c.jid === selectedChannelId) || globalChan;
    const finalPhone = useCustomPhone
      ? customPhone
      : selectedChan?.jid || globalChan?.jid || DESTINATIONS.whatsapp.defaultChannelId || DESTINATIONS.whatsapp.defaultRecipient;
    const finalChannelName = useCustomPhone
      ? `Número: ${customPhone}`
      : selectedChan?.name || globalChan?.name || 'Canal Global';

    const fullMessage = `*${title.trim()}*\n\n${textContent.trim()}`;

    if (dispatchMode === 'immediate') {
      const sendRes = await sendWhatsAppDirectMessage({
        recipient: finalPhone,
        text: fullMessage,
        imageUrl: selectedImage || null,
        audioUrl: audioUrl || null,
      });

      const newDevocional: Devocional = {
        id: `dev-${Date.now()}`,
        title,
        textContent,
        imageUrl: selectedImage || null,
        audioUrl: audioUrl || null,
        audioName: audioName || null,
        channelId: useCustomPhone ? null : selectedChannelId || null,
        channelName: finalChannelName,
        targetPhone: finalPhone,
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: sendRes.success ? 'DISPARADO' : 'PENDENTE',
        createdAt: new Date().toISOString(),
      };

      setDevocionais((prev) => [newDevocional, ...prev]);

      if (sendRes.success) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        setFeedback({
          type: 'success',
          text: `🚀 Devocional "${title}" DISPARADO com sucesso pelo WhatsApp para ${finalChannelName}!`,
        });
      } else {
        setFeedback({
          type: 'error',
          text: `Devocional salvo, mas o envio imediato falhou: ${sendRes.error}`,
        });
      }
    } else {
      const newDevocional: Devocional = {
        id: `dev-${Date.now()}`,
        title,
        textContent,
        imageUrl: selectedImage || null,
        audioUrl: audioUrl || null,
        audioName: audioName || null,
        channelId: useCustomPhone ? null : selectedChannelId || null,
        channelName: finalChannelName,
        targetPhone: finalPhone,
        scheduledDate,
        scheduledTime,
        status: 'PENDENTE',
        createdAt: new Date().toISOString(),
      };

      setDevocionais((prev) => [newDevocional, ...prev]);
      confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
      setFeedback({
        type: 'success',
        text: `📅 Devocional "${title}" programado para ${scheduledDate} às ${scheduledTime} via ${finalChannelName}. O agendador enviará automaticamente no horário.`,
      });
    }

    setIsCreating(false);
    resetForm();
    setIsSubmitting(false);
    setTimeout(() => setFeedback(null), 8000);
  };

  const handleDelete = (id: string) => {
    setDevocionais((prev) => prev.filter((d) => d.id !== id));
  };

  const handleDispatchNow = async (dev: Devocional) => {
    setDispatchingId(dev.id);
    const fullMessage = `*${dev.title.trim()}*\n\n${dev.textContent.trim()}`;
    const globalChan = getGlobalWhatsAppChannel();
    const target = dev.targetPhone || globalChan?.jid || DESTINATIONS.whatsapp.defaultChannelId || DESTINATIONS.whatsapp.defaultRecipient;

    const res = await sendWhatsAppDirectMessage({
      recipient: target,
      text: fullMessage,
      imageUrl: dev.imageUrl,
      audioUrl: dev.audioUrl,
    });
    setDispatchingId(null);

    if (res.success) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      setDevocionais((prev) =>
        prev.map((d) => (d.id === dev.id ? { ...d, status: 'DISPARADO' } : d))
      );
      setFeedback({
        type: 'success',
        text: `🚀 Devocional "${dev.title}" enviado com sucesso via WhatsApp!`,
      });
    } else {
      setFeedback({
        type: 'error',
        text: `Falha ao disparar pelo WhatsApp: ${res.error}. Verifique se o Agent Go está rodando e conectado.`,
      });
    }
    setTimeout(() => setFeedback(null), 8000);
  };

  const statusBadgeClass = (status: Devocional['status']) => {
    if (status === 'DISPARADO') return 'bg-emerald-900/40 text-emerald-300 border border-emerald-700';
    if (status === 'PENDENTE') return 'bg-amber-900/40 text-amber-300 border border-amber-700';
    return 'bg-rose-900/40 text-rose-300 border border-rose-800';
  };

  const getChannelBadge = (type: WaDestination['type']) => {
    switch (type) {
      case 'group':
        return <span className="bg-blue-900/30 text-blue-300 border border-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">GRUPO</span>;
      case 'community':
        return <span className="bg-indigo-900/30 text-indigo-300 border border-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded">COMUNIDADE</span>;
      case 'newsletter':
        return <span className="bg-purple-900/30 text-purple-300 border border-purple-700 text-[10px] font-bold px-2 py-0.5 rounded">CANAL</span>;
      case 'contact':
        return <span className="bg-emerald-900/30 text-emerald-300 border border-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded">CONTATO</span>;
      default:
        return <span className="bg-[#1F2937] text-[#9CA3AF] border border-[#374151] text-[10px] font-bold px-2 py-0.5 rounded">DIRETO</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-8 min-w-0 w-full">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-[#374151] pb-4 sm:pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-[#10B981] shrink-0" />
            <span>Programação de Devocionais</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#9CA3AF] mt-1 leading-relaxed">
            Componha e agende mensagens com Imagem, Áudio e Texto para envio automático no WhatsApp.
          </p>
        </div>
        <button
          onClick={() => {
            setIsCreating(!isCreating);
            if (isCreating) resetForm();
          }}
          className="w-full sm:w-auto justify-center px-4 sm:px-5 py-2.5 bg-[#0077C8] hover:bg-[#005F9E] text-white font-bold rounded-xl text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer shadow"
        >
          {isCreating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{isCreating ? 'Fechar Construtor' : 'Novo Devocional'}</span>
        </button>
      </div>

      {/* ── Feedback ── */}
      {feedback && (
        <div
          className={`p-3.5 sm:p-4 rounded-xl flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-900/30 border border-emerald-800 text-emerald-300'
              : 'bg-rose-900/30 border border-rose-800 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="shrink-0 opacity-60 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Formulário de Composição ── */}
      {isCreating && (
        <div className="bg-[#111827] border-2 border-[#0077C8]/40 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-[#374151] pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#F5A800]" />
              Construtor de Devocional WhatsApp
            </h3>
            <button
              onClick={() => {
                setIsCreating(false);
                resetForm();
              }}
              className="p-1.5 text-[#9CA3AF] hover:text-white rounded-lg bg-[#1F2937]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleScheduleSubmit} className="space-y-6">
            {/* 1. Importar Estudo */}
            <div className="bg-[#1F2937]/50 border border-[#374151] p-4 rounded-xl space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                1. Importar de Estudo Existente (Opcional)
              </label>
              <div className="relative">
                <select
                  value={selectedStudyId}
                  onChange={(e) => handleStudySelection(e.target.value)}
                  className="w-full appearance-none bg-[#111827] border border-[#374151] px-4 py-2.5 pr-10 rounded-lg text-sm text-white focus:outline-none focus:border-[#0077C8]"
                >
                  <option value="">— Compor livremente do zero —</option>
                  {studies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {getStudyTitle(s)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
              </div>
            </div>

            {/* 2. Título + Texto */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                  Título do Devocional *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Maturidade Cristã — Efésios 4:13"
                  className="w-full bg-[#1F2937] border border-[#374151] px-4 py-3 rounded-lg text-sm text-white focus:outline-none focus:border-[#0077C8]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#0077C8]" />
                  Texto da Mensagem (WhatsApp) *
                </label>
                <textarea
                  rows={6}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Escreva a mensagem devocional que será enviada pelo WhatsApp..."
                  className="w-full bg-[#1F2937] border border-[#374151] px-4 py-3 rounded-lg text-sm text-white focus:outline-none focus:border-[#0077C8] resize-none"
                  required
                />
                <p className="text-xs text-[#9CA3AF] mt-1">{textContent.length} caracteres</p>
              </div>
            </div>

            {/* 3. Imagem + Áudio Anexos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* IMAGEM */}
              <div className="space-y-2 bg-[#1F2937]/30 border border-[#374151] p-4 rounded-xl">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-[#10B981]" />
                    Imagem Anexa (WhatsApp)
                  </span>
                  {selectedImage && (
                    <button
                      type="button"
                      onClick={() => setSelectedImage('')}
                      className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                </label>

                <input
                  type="text"
                  value={selectedImage.startsWith('data:') ? '[Imagem Local Carregada]' : selectedImage}
                  onChange={(e) => setSelectedImage(e.target.value)}
                  placeholder="Cole a URL da imagem ou anexe abaixo..."
                  className="w-full bg-[#111827] border border-[#374151] px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:border-[#0077C8]"
                />

                <div className="flex gap-2 pt-1">
                  <input
                    type="file"
                    ref={imageInputRef}
                    onChange={handleLocalImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex-1 py-1.5 bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border border-[#374151] transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Foto
                  </button>

                  {galeriaFiles.length > 0 && (
                    <select
                      onChange={(e) => setSelectedImage(e.target.value)}
                      className="flex-1 bg-[#1F2937] border border-[#374151] px-2 py-1.5 rounded-lg text-xs text-[#9CA3AF]"
                    >
                      <option value="">Da Galeria...</option>
                      {galeriaFiles.map((gf) => (
                        <option key={gf.id} value={gf.driveWebViewLink || ''}>
                          {gf.originalName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedImage && (
                  <div className="relative pt-2">
                    <img
                      src={selectedImage}
                      alt="Preview"
                      className="w-full h-28 object-cover rounded-lg border border-[#374151]"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* ÁUDIO */}
              <div className="space-y-2 bg-[#1F2937]/30 border border-[#374151] p-4 rounded-xl">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Music className="w-4 h-4 text-[#F5A800]" />
                    Áudio / Mensagem de Voz
                  </span>
                  {(audioUrl || audioName) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAudioUrl('');
                        setAudioName('');
                      }}
                      className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                </label>

                <input
                  type="text"
                  value={audioUrl.startsWith('data:') ? `[Áudio Carregado: ${audioName}]` : audioUrl}
                  onChange={(e) => {
                    setAudioUrl(e.target.value);
                    setAudioName(e.target.value);
                  }}
                  placeholder="URL do áudio (.mp3, .m4a) ou anexe abaixo..."
                  className="w-full bg-[#111827] border border-[#374151] px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:border-[#0077C8]"
                />

                <div className="pt-1">
                  <input
                    type="file"
                    ref={audioInputRef}
                    onChange={handleLocalAudioUpload}
                    accept="audio/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="w-full py-1.5 bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border border-[#374151] transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Arquivo de Áudio (.mp3)
                  </button>
                </div>

                {audioName && (
                  <p className="text-xs text-emerald-400 font-medium flex items-center gap-1 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Anexo: {audioName}
                  </p>
                )}
              </div>
            </div>

            {/* 4. Destino WhatsApp COM BUSCA AUTOMÁTICA DE GRUPOS */}
            <div className="border border-[#374151] rounded-xl p-5 space-y-4 bg-[#1F2937]/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#374151] pb-3">
                <label className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-[#10B981]" />
                  Destino do Envio no WhatsApp *
                </label>

                {/* Botão de busca de grupos ao vivo */}
                <button
                  type="button"
                  onClick={handleFetchLiveGroups}
                  disabled={isSearchingGroups}
                  className="px-3 py-1.5 bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition self-start sm:self-auto"
                >
                  <Users className={`w-3.5 h-3.5 ${isSearchingGroups ? 'animate-spin' : ''}`} />
                  <span>{isSearchingGroups ? 'Buscando do WhatsApp...' : 'Buscar Grupos do WhatsApp'}</span>
                </button>
              </div>

              {searchFeedback && (
                <p className="text-xs text-[#10B981] bg-[#111827] p-2.5 rounded-lg border border-[#374151]">
                  {searchFeedback}
                </p>
              )}

              {/* Toggle: Canal/Grupo cadastrado vs número avulso */}
              <div className="flex gap-2 bg-[#1F2937] p-1 rounded-lg border border-[#374151]">
                <button
                  type="button"
                  onClick={() => setUseCustomPhone(false)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition flex items-center justify-center gap-1.5 ${
                    !useCustomPhone ? 'bg-[#0077C8] text-white' : 'text-[#9CA3AF]'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Canais e Grupos Listados ({waChannels.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUseCustomPhone(true)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition flex items-center justify-center gap-1.5 ${
                    useCustomPhone ? 'bg-[#0077C8] text-white' : 'text-[#9CA3AF]'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  Digitar Número Avulso
                </button>
              </div>

              {!useCustomPhone ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {waChannels.map((ch) => (
                    <label
                      key={ch.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedChannelId === ch.id
                          ? 'border-[#10B981] bg-[#10B981]/10'
                          : 'border-[#374151] hover:border-[#4B5563]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="waChannel"
                        value={ch.id}
                        checked={selectedChannelId === ch.id}
                        onChange={() => setSelectedChannelId(ch.id)}
                        className="accent-[#10B981] w-4 h-4"
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">{ch.name}</span>
                          {getChannelBadge(ch.type)}
                        </div>
                        <span className="text-xs text-[#9CA3AF] font-mono truncate">{ch.jid}</span>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-[#9CA3AF]" />
                    <input
                      type="text"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="Ex: 5511999998888"
                      className="w-full bg-[#1F2937] border border-[#374151] pl-10 pr-4 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:border-[#0077C8]"
                    />
                  </div>
                  <p className="text-xs text-[#9CA3AF]">
                    Formato: código do país + DDD + número (ex: 5511999998888).
                  </p>
                </div>
              )}
            </div>

            {/* 5. MODO DE ENVIO: IMEDIATO vs AGENDADO */}
            <div className="border border-[#374151] rounded-xl p-5 space-y-4 bg-[#1F2937]/30">
              <label className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#F5A800]" />
                Modo de Envio *
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDispatchMode('immediate')}
                  className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition cursor-pointer ${
                    dispatchMode === 'immediate'
                      ? 'border-[#10B981] bg-[#10B981]/15 text-white'
                      : 'border-[#374151] text-[#9CA3AF] hover:border-[#4B5563]'
                  }`}
                >
                  <SendHorizontal className={`w-5 h-5 ${dispatchMode === 'immediate' ? 'text-[#10B981]' : ''}`} />
                  <div>
                    <p className="text-sm font-bold text-white">⚡ Disparar Imediatamente (Agora)</p>
                    <p className="text-xs text-[#9CA3AF]">Envia a mensagem no WhatsApp assim que você clicar em confirmar.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDispatchMode('scheduled')}
                  className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition cursor-pointer ${
                    dispatchMode === 'scheduled'
                      ? 'border-[#0077C8] bg-[#0077C8]/15 text-white'
                      : 'border-[#374151] text-[#9CA3AF] hover:border-[#4B5563]'
                  }`}
                >
                  <Calendar className={`w-5 h-5 ${dispatchMode === 'scheduled' ? 'text-[#0077C8]' : ''}`} />
                  <div>
                    <p className="text-sm font-bold text-white">📅 Agendar Data e Horário</p>
                    <p className="text-xs text-[#9CA3AF]">Salva no cronograma para envio posterior.</p>
                  </div>
                </button>
              </div>

              {dispatchMode === 'scheduled' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-[#0077C8]" />
                      Data de Envio *
                    </label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-[#0077C8]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#F5A800]" />
                      Horário *
                    </label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full bg-[#1F2937] border border-[#374151] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-[#0077C8]"
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-[#374151]">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  resetForm();
                }}
                className="px-5 py-2.5 bg-[#1F2937] hover:bg-[#374151] text-white rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-6 py-2.5 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer shadow ${
                  dispatchMode === 'immediate'
                    ? 'bg-[#10B981] hover:bg-[#059669]'
                    : 'bg-[#0077C8] hover:bg-[#005F9E]'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? dispatchMode === 'immediate'
                      ? 'Disparando no WhatsApp...'
                      : 'Programando...'
                    : dispatchMode === 'immediate'
                    ? '⚡ Disparar no WhatsApp Agora'
                    : '📅 Confirmar Programação'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Lista de Devocionais ── */}
      <div className="space-y-4">
        <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#0077C8] shrink-0" />
          <span>Cronograma ({devocionais.length})</span>
        </h3>

        {devocionais.length === 0 ? (
          <div className="text-center py-16 bg-[#111827] border border-[#374151] rounded-2xl space-y-3 px-4">
            <Calendar className="w-12 h-12 mx-auto text-[#9CA3AF] opacity-40" />
            <h4 className="text-base sm:text-lg font-bold text-white">Nenhum devocional agendado</h4>
            <p className="text-xs sm:text-sm text-[#9CA3AF]">Clique em "Novo Devocional" para programar ou disparar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {devocionais.map((dev) => (
              <div
                key={dev.id}
                className="bg-[#111827] border border-[#374151] hover:border-[#4B5563] rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3.5 sm:space-y-4 transition shadow-sm"
              >
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${statusBadgeClass(dev.status)}`}>
                      {dev.status}
                    </span>
                    <span className="text-xs font-mono text-[#F5A800] flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{dev.scheduledDate} às {dev.scheduledTime}</span>
                    </span>
                  </div>

                  <h4 className="font-bold text-sm sm:text-base text-white line-clamp-1">{dev.title}</h4>
                  <p className="text-xs text-[#9CA3AF] line-clamp-3 leading-relaxed">{dev.textContent}</p>

                  <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1 text-[11px]">
                    {dev.imageUrl && (
                      <span className="bg-[#1F2937] px-2 py-0.5 rounded flex items-center gap-1 text-emerald-400">
                        <ImageIcon className="w-3 h-3" /> Imagem Anexa
                      </span>
                    )}
                    {(dev.audioUrl || dev.audioName) && (
                      <span className="bg-[#1F2937] px-2 py-0.5 rounded flex items-center gap-1 text-blue-400">
                        <Music className="w-3 h-3" /> {dev.audioName || 'Áudio Anexo'}
                      </span>
                    )}
                    <span className="bg-[#1F2937] px-2 py-0.5 rounded flex items-center gap-1 text-[#E5E7EB] truncate max-w-full">
                      <MessageCircle className="w-3 h-3 shrink-0" /> <span className="truncate">{dev.channelName || dev.targetPhone}</span>
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#374151] flex items-center justify-between gap-2">
                  {dev.status === 'PENDENTE' ? (
                    <button
                      onClick={() => handleDispatchNow(dev)}
                      disabled={dispatchingId === dev.id}
                      className="text-xs px-3.5 py-2 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700 rounded-xl font-bold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Send className={`w-3 h-3 ${dispatchingId === dev.id ? 'animate-spin' : ''}`} />
                      <span>{dispatchingId === dev.id ? 'Disparando...' : '⚡ Disparar Agora'}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Disparado via WhatsApp
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(dev.id)}
                    className="p-1.5 text-[#9CA3AF] hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};