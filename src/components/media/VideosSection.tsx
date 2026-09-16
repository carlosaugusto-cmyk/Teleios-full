import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, ArrowRight, Play, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { VideoMetadata } from '../../types/index.ts';

interface VideosSectionProps {
  videos: VideoMetadata[];
  isLoading: boolean;
  error?: string | null;
}

export const VideosSection: React.FC<VideosSectionProps> = ({
  videos,
  isLoading,
  error,
}) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const displayedVideos = showAll ? videos : videos.slice(0, 8);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#374151] pb-4">
        <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2.5">
          <Video className="w-6 h-6 text-[#EF4444]" />
          Vídeos & Mensagens
        </h2>
        {videos.length > 8 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#EF4444] hover:text-[#F87171] transition-colors cursor-pointer"
          >
            <span>{showAll ? 'Mostrar Menos' : `Ver todos (${videos.length})`}</span>
            {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-[#111827] rounded-xl border border-[#374151] overflow-hidden h-[340px] animate-pulse flex flex-col"
            >
              <div className="h-48 bg-[#1F2937]" />
              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div className="h-5 bg-[#1F2937] rounded w-3/4" />
                <div className="h-4 bg-[#1F2937] rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 bg-[#111827] border border-rose-900/40 rounded-xl text-center text-xs text-rose-400">
          {error}
        </div>
      ) : videos.length === 0 ? (
        <div className="p-8 bg-[#111827] border border-[#374151] rounded-xl text-center space-y-2">
          <Video className="w-10 h-10 mx-auto text-[#9CA3AF] opacity-40" />
          <p className="text-sm font-bold text-white">Nenhum vídeo publicado ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayedVideos.map((video) => (
            <div
              key={video.id}
              onClick={() => navigate(`/documento/${video.id}`)}
              className="bg-[#111827] rounded-xl border border-[#374151] overflow-hidden cursor-pointer group hover:border-[#EF4444] transition-all flex flex-col min-h-[340px] shadow-sm hover:shadow-md"
            >
              <div className="h-48 relative bg-black flex items-center justify-center overflow-hidden">
                <img
                  src={
                    video.thumbnailUrl ||
                    (video.youtubeVideoId
                      ? `https://img.youtube.com/vi/${video.youtubeVideoId}/hqdefault.jpg`
                      : 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=800&q=80')
                  }
                  alt={video.title}
                  loading="lazy"
                  className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition">
                  <div className="w-12 h-12 rounded-full bg-[#EF4444] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                    <Play className="w-5 h-5 ml-1 fill-current" />
                  </div>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base text-white mb-2 line-clamp-2 group-hover:text-[#EF4444] transition-colors">
                    {video.title}
                  </h3>
                  <p className="text-xs text-[#9CA3AF] line-clamp-2">
                    {video.description || 'Assista a esta mensagem.'}
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-[#374151] flex justify-between items-center text-xs text-[#9CA3AF]">
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5" />
                    {video.publishedAt
                      ? new Date(video.publishedAt).toLocaleDateString('pt-BR')
                      : 'Vídeo'}
                  </span>
                  <span className="text-[#EF4444] font-bold text-xs uppercase flex items-center gap-1">
                    Assistir <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};