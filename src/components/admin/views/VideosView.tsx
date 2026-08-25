import React from 'react';
import { Video as VideoIcon, RefreshCw, Play, ExternalLink } from 'lucide-react';
import { VideoMetadata } from '../../../types/index.ts';

interface VideosViewProps {
  videos: VideoMetadata[];
  onRefresh: () => void;
}

export const VideosView: React.FC<VideosViewProps> = ({ videos, onRefresh }) => {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <VideoIcon className="w-6 h-6 text-[#EF4444]" />
          Vídeos
        </h2>
        <button
          onClick={onRefresh}
          className="p-2 bg-[#1F2937] hover:bg-[#374151] text-white rounded-lg transition-colors border border-[#374151]"
          title="Atualizar"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-20 bg-[#111827] border border-[#374151] rounded-xl text-[#9CA3AF]">
          <VideoIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-white">Nenhum vídeo catalogado.</p>
          <p className="text-sm mt-1">Envie arquivos MP4 na aba "Novo Arquivo".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <div key={video.id} className="bg-[#111827] border border-[#374151] rounded-xl overflow-hidden flex flex-col">
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
                    <Play className="w-10 h-10" />
                    <span className="text-sm font-medium">Processando...</span>
                  </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-lg text-white mb-2 line-clamp-2">{video.title}</h3>
                {video.description && (
                  <p className="text-sm text-[#9CA3AF] line-clamp-3 mb-4 flex-1">{video.description}</p>
                )}
                <div className="mt-auto pt-4 border-t border-[#374151]">
                  {video.mediaFile?.youtubeVideoId ? (
                    <a
                      href={`https://youtube.com/watch?v=${video.mediaFile.youtubeVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-bold rounded-lg transition-colors"
                    >
                      Ver no YouTube <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="flex items-center justify-center w-full py-2 bg-[#374151] text-[#9CA3AF] text-sm font-bold rounded-lg">
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