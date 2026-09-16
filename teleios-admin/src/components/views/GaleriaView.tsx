import React, { useState } from 'react';
import { Image as ImageIcon, RefreshCw, ExternalLink, X } from 'lucide-react';
import { MediaFile } from '../../types/index.ts';

interface GaleriaViewProps {
  files: MediaFile[];
  onRefresh: () => void;
}

export const GaleriaView: React.FC<GaleriaViewProps> = ({ files, onRefresh }) => {
  const [selectedImage, setSelectedImage] = useState<MediaFile | null>(null);

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 min-w-0 w-full">
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#10B981] shrink-0" />
          <span>Galeria</span>
        </h2>
        <button
          onClick={onRefresh}
          className="p-2 bg-[#1F2937] hover:bg-[#374151] text-white rounded-xl transition-colors border border-[#374151] cursor-pointer"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-16 sm:py-20 bg-[#111827] border border-[#374151] rounded-2xl text-[#9CA3AF] px-4">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-40 text-[#10B981]" />
          <p className="text-base sm:text-lg font-medium text-white">Nenhuma imagem na galeria.</p>
          <p className="text-xs sm:text-sm mt-1">Envie imagens na aba "Novo Arquivo".</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="bg-[#111827] border border-[#374151] rounded-xl sm:rounded-2xl overflow-hidden group cursor-pointer shadow-sm"
              onClick={() => setSelectedImage(file)}
            >
              <div className="aspect-square bg-black relative">
                <img
                  src={file.driveWebViewLink || 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80'}
                  alt={file.originalName}
                  className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition duration-300"
                />
              </div>
              <div className="p-2.5 sm:p-3">
                <h3 className="font-medium text-xs sm:text-sm text-white truncate" title={file.originalName}>{file.originalName}</h3>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <img
              src={selectedImage.driveWebViewLink || ''}
              alt={selectedImage.originalName}
              className="w-full h-auto max-h-[80vh] sm:max-h-[85vh] object-contain rounded-xl"
            />
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex gap-2">
              <a
                href={selectedImage.driveWebViewLink || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-[#1F2937]/80 hover:bg-[#374151] text-white rounded-xl backdrop-blur-sm"
                title="Abrir no Drive"
              >
                <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-2 bg-[#1F2937]/80 hover:bg-[#374151] text-white rounded-xl backdrop-blur-sm cursor-pointer"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 bg-black/70 p-3 sm:p-4 rounded-xl backdrop-blur-md">
              <p className="text-white font-medium text-xs sm:text-sm truncate">{selectedImage.originalName}</p>
              <p className="text-[#9CA3AF] text-[11px] sm:text-xs mt-0.5">{(selectedImage.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};