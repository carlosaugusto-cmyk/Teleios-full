import React, { useState } from 'react';
import { Image as ImageIcon, RefreshCw, ExternalLink, X } from 'lucide-react';
import { MediaFile } from '../../../types/index.ts';

interface GaleriaViewProps {
  files: MediaFile[];
  onRefresh: () => void;
}

export const GaleriaView: React.FC<GaleriaViewProps> = ({ files, onRefresh }) => {
  const [selectedImage, setSelectedImage] = useState<MediaFile | null>(null);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-[#10B981]" />
          Galeria
        </h2>
        <button
          onClick={onRefresh}
          className="p-2 bg-[#1F2937] hover:bg-[#374151] text-white rounded-lg transition-colors border border-[#374151]"
          title="Atualizar"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-20 bg-[#111827] border border-[#374151] rounded-xl text-[#9CA3AF]">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-white">Nenhuma imagem na galeria.</p>
          <p className="text-sm mt-1">Envie imagens na aba "Novo Arquivo".</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="bg-[#111827] border border-[#374151] rounded-xl overflow-hidden group cursor-pointer"
              onClick={() => setSelectedImage(file)}
            >
              <div className="aspect-square bg-black relative">
                <img
                  src={file.driveWebViewLink || 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80'}
                  alt={file.originalName}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition duration-300"
                />
              </div>
              <div className="p-3">
                <h3 className="font-medium text-sm text-white truncate" title={file.originalName}>{file.originalName}</h3>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <img
              src={selectedImage.driveWebViewLink || ''}
              alt={selectedImage.originalName}
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <a
                href={selectedImage.driveWebViewLink || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-[#1F2937] hover:bg-[#374151] text-white rounded-lg"
                title="Abrir no Drive"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-2 bg-[#1F2937] hover:bg-[#374151] text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="absolute bottom-4 left-4 right-4 bg-black/60 p-4 rounded-lg backdrop-blur-md">
              <p className="text-white font-medium">{selectedImage.originalName}</p>
              <p className="text-[#9CA3AF] text-sm">{(selectedImage.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};