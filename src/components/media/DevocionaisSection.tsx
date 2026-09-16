import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, Clock, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Study } from '../../types/index.ts';
import { getStudyTitle, getStudyPreviewText, isStudyBinary } from '../../utils/contentSanitizer.ts';

interface DevocionaisSectionProps {
  devocionais: Study[];
  isLoading: boolean;
  error?: string | null;
}

export const DevocionaisSection: React.FC<DevocionaisSectionProps> = ({
  devocionais,
  isLoading,
  error,
}) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const displayedDevocionais = showAll ? devocionais : devocionais.slice(0, 8);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#374151] pb-4">
        <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-[#0077C8]" />
          Devocionais e Estudos
        </h2>
        {devocionais.length > 8 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0077C8] hover:text-[#38BDF8] transition-colors cursor-pointer"
          >
            <span>{showAll ? 'Mostrar Menos' : `Ver todos (${devocionais.length})`}</span>
            {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-[#111827] rounded-xl border border-[#374151] overflow-hidden h-[360px] animate-pulse flex flex-col"
            >
              <div className="h-44 bg-[#1F2937]" />
              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="h-5 bg-[#1F2937] rounded w-3/4" />
                  <div className="h-4 bg-[#1F2937] rounded w-full" />
                </div>
                <div className="h-8 bg-[#1F2937] rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 bg-[#111827] border border-rose-900/40 rounded-xl text-center text-xs text-rose-400">
          {error}
        </div>
      ) : devocionais.length === 0 ? (
        <div className="p-8 bg-[#111827] border border-[#374151] rounded-xl text-center space-y-2">
          <BookOpen className="w-10 h-10 mx-auto text-[#9CA3AF] opacity-40" />
          <p className="text-sm font-bold text-white">Nenhum devocional publicado ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayedDevocionais.map((study) => {
            const title = getStudyTitle(study);
            const preview = getStudyPreviewText(study);
            const isBinary = isStudyBinary(study);
            const imgSrc =
              study.generatedImgUrl ||
              study.aiImageUrl ||
              'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80';

            return (
              <div
                key={study.id}
                onClick={() => navigate(`/documento/${study.id}`)}
                className="bg-[#111827] rounded-xl border border-[#374151] overflow-hidden cursor-pointer group hover:border-[#0077C8] transition-all flex flex-col h-full min-h-[380px] shadow-sm hover:shadow-md"
              >
                <div className="h-44 relative bg-black overflow-hidden">
                  <img
                    src={imgSrc}
                    alt={title}
                    loading="lazy"
                    className="w-full h-full object-cover opacity-80 group-hover:scale-105 group-hover:opacity-95 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-transparent to-transparent" />
                  {study.topic && (
                    <span className="absolute bottom-3 left-3 text-white text-[11px] font-bold uppercase bg-[#0077C8]/90 px-2.5 py-0.5 rounded shadow">
                      {study.topic}
                    </span>
                  )}
                  {isBinary && (
                    <span className="absolute top-3 right-3 text-white text-[10px] font-bold bg-amber-600/90 px-2 py-0.5 rounded flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Documento
                    </span>
                  )}
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3
                      className="font-serif font-bold text-lg text-white group-hover:text-[#F5A800] transition-colors line-clamp-2"
                      title={title}
                    >
                      {title}
                    </h3>
                    <p className="text-xs text-[#9CA3AF] line-clamp-3 leading-relaxed">
                      {preview}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[#374151] flex items-center justify-between">
                    <span className="text-[11px] font-mono text-[#9CA3AF] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {study.scheduledAt
                        ? new Date(study.scheduledAt).toLocaleDateString('pt-BR')
                        : 'Devocional'}
                    </span>
                    <span className="px-3 py-1 bg-[#1F2937] group-hover:bg-[#0077C8] text-white rounded font-bold text-xs uppercase border border-[#374151] transition-colors flex items-center gap-1">
                      Ler <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};