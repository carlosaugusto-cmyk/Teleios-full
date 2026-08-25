import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Video, Image as ImageIcon, Search, ArrowLeft, ExternalLink, X, CheckCircle2, Play, Eye } from 'lucide-react';
import { Study, MediaFile, VideoMetadata } from '../../types/index.ts';
import { apiFetch } from '../../services/api.service.ts';

export default function MidiasPage() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [galeriaFiles, setGaleriaFiles] = useState<MediaFile[]>([]);
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'estudos' | 'videos' | 'galeria') || 'estudos';
  const [activeTab, setActiveTab] = useState<'estudos' | 'videos' | 'galeria'>(initialTab);
  
  const [studySearchTerm, setStudySearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  
  const [selectedStudyModal, setSelectedStudyModal] = useState<Study | null>(null);
  const [selectedVideoModal, setSelectedVideoModal] = useState<VideoMetadata | null>(null);
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<any | null>(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      apiFetch('/api/estudos').then(r => r.json()).catch(() => ({ success: false })),
      apiFetch('/api/galeria').then(r => r.json()).catch(() => ({ success: false })),
      apiFetch('/api/videos').then(r => r.json()).catch(() => ({ success: false })),
    ]).then(([e, g, v]) => {
      if (e.success) setStudies(e.data);
      if (g.success) setGaleriaFiles(g.data);
      if (v.success) setVideos(v.data);
    });
  }, []);

  const handleTabChange = (tab: 'estudos' | 'videos' | 'galeria') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const filteredStudies = studies.filter((s) => {
    if (!studySearchTerm) return true;
    const term = studySearchTerm.toLowerCase();
    const title = s.title || s.mediaFile?.originalName || '';
    return (
      title.toLowerCase().includes(term) ||
      (s.summary && s.summary.toLowerCase().includes(term)) ||
      (s.topic && s.topic.toLowerCase().includes(term))
    );
  });

  const photoGallery = [
    {
      id: 'img-1',
      title: 'Ação Social Mesa Solidária',
      category: 'projetos',
      categoryLabel: 'Ação Social',
      date: 'Agosto 2026',
      description: 'Entrega de mais de 200 cestas de alimentos e kits de higiene para famílias da comunidade.',
      image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'img-2',
      title: 'Encontro de Jovens & Comunhão',
      category: 'encontros',
      categoryLabel: 'Juventude',
      date: 'Julho 2026',
      description: 'Momento de louvor, palavra e comunhão com mais de 150 jovens da região.',
      image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'img-3',
      title: 'Aconselhamento Fraterno',
      category: 'acolhimento',
      categoryLabel: 'Acolhimento',
      date: 'Junho 2026',
      description: 'Sessões de escuta ativa e apoio emocional para famílias em situação de vulnerabilidade.',
      image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=1200&q=80',
    }
  ];

  const filteredPhotos = selectedCategory === 'todos' ? photoGallery : photoGallery.filter(p => p.category === selectedCategory);

  return (
    <div className="bg-primary text-primary min-h-screen flex flex-col font-sans" style={{ backgroundColor: '#0A0F1A', color: '#F9FAFB' }}>
      <header className="sticky top-0 z-40 border-b shadow-sm transition-all" style={{ backgroundColor: 'rgba(17,24,39,0.97)', borderColor: '#374151', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-20">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-text-secondary hover:text-brand-blue font-bold text-sm uppercase transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Voltar para o Início
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        <div className="text-center space-y-3">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold">Conteúdos & Mídias</h1>
          <p className="text-text-secondary">Explore nossos estudos bíblicos, assista pregações ou veja a galeria de fotos.</p>
        </div>

        <div className="flex justify-center">
          <div className="bg-secondary p-1.5 rounded-xl border border-border-default flex flex-wrap justify-center gap-1">
            <button
              onClick={() => handleTabChange('estudos')}
              className={`px-5 py-3 rounded-lg text-sm font-bold uppercase transition-colors flex items-center gap-2 ${
                activeTab === 'estudos' ? 'bg-brand-blue text-white' : 'text-text-secondary hover:bg-tertiary'
              }`}
            >
              <BookOpen className="w-4 h-4" /> Estudos Bíblicos
            </button>
            <button
              onClick={() => handleTabChange('videos')}
              className={`px-5 py-3 rounded-lg text-sm font-bold uppercase transition-colors flex items-center gap-2 ${
                activeTab === 'videos' ? 'bg-brand-red text-white' : 'text-text-secondary hover:bg-tertiary'
              }`}
            >
              <Video className="w-4 h-4" /> Vídeos & Pregações
            </button>
            <button
              onClick={() => handleTabChange('galeria')}
              className={`px-5 py-3 rounded-lg text-sm font-bold uppercase transition-colors flex items-center gap-2 ${
                activeTab === 'galeria' ? 'bg-brand-green text-white' : 'text-text-secondary hover:bg-tertiary'
              }`}
            >
              <ImageIcon className="w-4 h-4" /> Galeria de Fotos
            </button>
          </div>
        </div>

        {activeTab === 'estudos' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center border-b border-border-default pb-6">
              <h2 className="text-2xl font-serif font-bold">Estudos Disponíveis</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Buscar estudos..."
                  value={studySearchTerm}
                  onChange={(e) => setStudySearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-tertiary border border-border-default rounded-lg text-sm w-64 text-text-primary"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudies.map((study) => (
                <div
                  key={study.id}
                  onClick={() => setSelectedStudyModal(study)}
                  className="bg-secondary rounded-xl border border-border-default overflow-hidden cursor-pointer group hover:border-brand-blue transition-colors flex flex-col h-full min-h-[420px]"
                >
                  <div className="h-48 relative bg-black">
                    <img
                      src={study.aiImageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'}
                      alt={study.title}
                      className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition duration-500"
                    />
                    {study.topic && (
                      <span className="absolute bottom-3 left-3 text-white text-xs font-bold uppercase bg-brand-blue/90 px-2 py-1 rounded">
                        {study.topic}
                      </span>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-serif font-bold text-lg mb-2" title={study.mediaFile?.originalName || study.title}>
                      {study.title || study.mediaFile?.originalName || 'Estudo sem título'}
                    </h3>
                    <p className="text-sm text-text-secondary line-clamp-3 flex-1">{study.summary || study.rawContent}</p>
                    <div className="pt-4 mt-4 border-t border-border-default flex items-center justify-between">
                      <span className="text-xs font-mono text-text-muted">{study.scheduledAt ? new Date(study.scheduledAt).toLocaleDateString('pt-BR') : 'Sem data'}</span>
                      <button className="px-4 py-2 bg-tertiary hover:bg-brand-navy hover:text-white rounded font-bold text-xs uppercase border border-border-default transition-colors flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" /> Ler
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredStudies.length === 0 && (
                <div className="col-span-full text-center py-12 bg-tertiary/50 rounded-xl border border-border-default">
                  <Search className="w-12 h-12 mx-auto text-text-muted mb-4" />
                  <h3 className="font-serif font-bold text-xl mb-2">Nenhum estudo encontrado</h3>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-serif font-bold border-b border-border-default pb-6">Vídeos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => setSelectedVideoModal(video)}
                  className="bg-secondary rounded-xl border border-border-default overflow-hidden cursor-pointer group hover:border-brand-red transition-colors flex flex-col min-h-[420px]"
                >
                  <div className="h-48 relative bg-black flex items-center justify-center">
                    <img src={video.thumbnailUrl || 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=800&q=80'} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-brand-red text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                        <Play className="w-6 h-6 ml-1 fill-current" />
                      </div>
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-serif font-bold text-lg mb-2">{video.title}</h3>
                    <p className="text-sm text-text-secondary line-clamp-2">{video.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'galeria' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center border-b border-border-default pb-6">
              <h2 className="text-2xl font-serif font-bold">Galeria de Fotos</h2>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-tertiary border border-border-default rounded-lg px-4 py-2 text-sm text-text-primary">
                <option value="todos">Todas as Categorias</option>
                <option value="projetos">Ação Social</option>
                <option value="encontros">Encontros</option>
                <option value="acolhimento">Acolhimento</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPhotos.map((photo) => (
                <div key={photo.id} onClick={() => setSelectedPhotoModal(photo)} className="bg-secondary rounded-xl border border-border-default overflow-hidden cursor-pointer group">
                  <div className="h-48 relative">
                    <img src={photo.image} alt={photo.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    <div className="absolute top-3 left-3 px-3 py-1 bg-brand-navy text-white text-xs font-bold rounded-full uppercase">
                      {photo.categoryLabel}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-serif font-bold">{photo.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {selectedStudyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedStudyModal(null)}>
          <div className="bg-secondary rounded-2xl border border-border-default max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-serif font-bold text-2xl text-text-primary">{selectedStudyModal.title}</h2>
                <button onClick={() => setSelectedStudyModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-tertiary"><X className="w-5 h-5"/></button>
              </div>
              <div className="prose prose-invert max-w-none text-text-secondary whitespace-pre-wrap">
                {selectedStudyModal.rawContent || selectedStudyModal.summary}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedVideoModal(null)}>
          <div className="bg-secondary rounded-2xl border border-border-default max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="relative aspect-video">
              {selectedVideoModal.youtubeVideoId ? (
                <iframe src={`https://www.youtube.com/embed/${selectedVideoModal.youtubeVideoId}?autoplay=1`} className="w-full h-full" allowFullScreen />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-black">
                   <Video className="w-16 h-16 text-brand-red mb-2" />
                   <p className="text-white">Vídeo não disponível.</p>
                </div>
              )}
              <button onClick={() => setSelectedVideoModal(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"><X className="w-5 h-5"/></button>
            </div>
          </div>
        </div>
      )}

      {selectedPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPhotoModal(null)}>
          <div className="bg-secondary rounded-2xl border border-border-default max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="relative">
              <img src={selectedPhotoModal.image} alt={selectedPhotoModal.title} className="w-full h-auto" />
              <button onClick={() => setSelectedPhotoModal(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"><X className="w-5 h-5"/></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
