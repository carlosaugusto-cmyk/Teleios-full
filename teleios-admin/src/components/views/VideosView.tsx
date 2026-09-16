import React from 'react';
import { Video as VideoIcon, RefreshCw, Play, ExternalLink } from 'lucide-react';
import { VideoMetadata } from '../../types/index.ts';

interface VideosViewProps {
  videos: VideoMetadata[];
  onRefresh: () => void;
}

export const VideosView: React.FC<VideosViewProps> = ({ videos, onRefresh }) => {
  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 min-w-0 w-full">
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <VideoIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#EF4444] shrink-0" />
          <span>Vídeos</span>
        </h2>
        <button
          onClick={onRefresh}
          className="p-2 bg-[#1F2937] hover:bg-[#374151] text-white rounded-xl transition-colors border border-[#374151] cursor-pointer"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-16 sm:py-20 bg-[#111827] border border-[#374151] rounded-2xl text-[#9CA3AF] px-4">
          <VideoIcon className="w-12 h-12 mx-auto mb-3 opacity-40 text-[#EF4444]" />
          <p className="text-base sm:text-lg font-medium text-white">Nenhum vídeo catalogado.</p>
          <p className="text-xs sm:text-sm mt-1">Envie arquivos MP4 na aba "Novo Arquivo".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {videos.map((video) => (
            <div key={video.id} className="bg-[#111827] border border-[#374151] rounded-2xl overflow-hidden flex flex-col shadow-sm">
              <div className="aspect-video bg-black relative flex items-center justify-center group border-b border-[#374151]">
                {video.mediaFile?.youtubeVideoId ? (
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${video.mediaFile.youtubeVideoId}`}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-[#9CA3AF]">
                    <Play className="w-8 h-8 sm:w-10 sm:h-10 text-[#4B5563]" />
                    <span className="text-xs font-medium">Processando...</span>
                  </div>
                )}
              </div>
              <div className="p-4 sm:p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-base sm:text-lg text-white mb-1.5 line-clamp-2">{video.title}</h3>
                {video.description && (
                  <p className="text-xs sm:text-sm text-[#9CA3AF] line-clamp-3 mb-3.5 flex-1">{video.description}</p>
                )}
                <div className="mt-auto pt-3 border-t border-[#374151]">
                  {video.mediaFile?.youtubeVideoId ? (
                    <a
                      href={`https://youtube.com/watch?v=${video.mediaFile.youtubeVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      <span>Ver no YouTube</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="flex items-center justify-center w-full py-2.5 bg-[#1F2937] text-[#9CA3AF] text-xs font-bold rounded-xl border border-[#374151]">
                      Indisponível
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};