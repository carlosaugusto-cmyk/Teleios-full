import React, { useState } from 'react';
import { Image as ImageIcon, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { MediaFile } from '../../types/index.ts';

interface GaleriaSectionProps {
  galeriaFiles: MediaFile[];
  isLoading: boolean;
  error?: string | null;
}

export const GaleriaSection: React.FC<GaleriaSectionProps> = ({
  galeriaFiles,
  isLoading,
  error,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const photos = galeriaFiles
    .map((f, idx) => ({
      id: f.id || `gal-${idx}`,
      title: f.originalName?.replace(/\.[^/.]+$/, '').replace(/[_\-]/g, ' ') || 'Foto do Ministério',
      date: f.createdAt ? new Date(f.createdAt).toLocaleDateString('pt-BR') : 'Foto',
      image: f.driveWebViewLink || (f.id ? `/api/media/${f.id}` : ''),
    }))
    .filter((p) => p.image);

  const displayedPhotos = showAll ? photos : photos.slice(0, 12);
  const currentPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    } else if (lightboxIndex === 0) {
      setLightboxIndex(photos.length - 1);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lightboxIndex !== null && lightboxIndex < photos.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    } else if (lightboxIndex === photos.length - 1) {
      setLightboxIndex(0);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#374151] pb-4">
        <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2.5">
          <ImageIcon className="w-6 h-6 text-[#10B981]" />
          Galeria de Fotos
        </h2>
        {photos.length > 12 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#10B981] hover:text-[#34D399] transition-colors cursor-pointer"
          >
            <span>{showAll ? 'Mostrar Menos' : `Ver todas (${photos.length})`}</span>
            {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="bg-[#111827] rounded-xl border border-[#374151] overflow-hidden h-40 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 bg-[#111827] border border-rose-900/40 rounded-xl text-center text-xs text-rose-400">
          {error}
        </div>
      ) : photos.length === 0 ? (
        <div className="p-8 bg-[#111827] border border-[#374151] rounded-xl text-center space-y-2">
          <ImageIcon className="w-10 h-10 mx-auto text-[#9CA3AF] opacity-40" />
          <p className="text-sm font-bold text-white">Nenhuma foto na galeria ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {displayedPhotos.map((photo, idx) => (
            <div
              key={photo.id}
              onClick={() => setLightboxIndex(idx)}
              className="group relative h-40 bg-[#111827] rounded-xl border border-[#374151] overflow-hidden cursor-pointer hover:border-[#10B981] transition-all shadow-sm"
            >
              <img
                src={photo.image}
                alt={photo.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-end">
                <p className="text-white text-xs font-bold truncate">{photo.title}</p>
                <p className="text-[10px] text-[#9CA3AF]">{photo.date}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {currentPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-black/70 border border-[#374151] text-white flex items-center justify-center hover:bg-black transition cursor-pointer z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {photos.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 border border-[#374151] text-white flex items-center justify-center hover:bg-black transition cursor-pointer z-10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 border border-[#374151] text-white flex items-center justify-center hover:bg-black transition cursor-pointer z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div
            className="max-w-4xl w-full max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentPhoto.image}
              alt={currentPhoto.title}
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-2xl border border-[#374151]"
            />
            <div className="mt-3 text-center">
              <h4 className="text-white font-bold text-sm">{currentPhoto.title}</h4>
              <p className="text-xs text-[#9CA3AF] mt-0.5">{currentPhoto.date}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};