import React, { useState } from 'react';
import { FolderKanban, RefreshCw, Search, FileText, Download } from 'lucide-react';
import { MediaFile } from '../../../types/index.ts';

interface ProjetosViewProps {
  files: MediaFile[];
  onRefresh: () => void;
}

export const ProjetosView: React.FC<ProjetosViewProps> = ({ files, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFiles = files.filter(f => 
    f.originalName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FolderKanban className="w-6 h-6 text-[#F5A800]" />
          Projetos & Apoio
        </h2>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Buscar arquivos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1F2937] border border-[#374151] pl-9 pr-3 py-2 text-sm text-white rounded-lg focus:outline-none focus:border-[#0077C8]"
            />
          </div>
          <button
            onClick={onRefresh}
            className="p-2 bg-[#1F2937] hover:bg-[#374151] text-white rounded-lg transition-colors border border-[#374151] shrink-0"
            title="Atualizar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {filteredFiles.length === 0 ? (
        <div className="text-center py-20 bg-[#111827] border border-[#374151] rounded-xl text-[#9CA3AF]">
          <FolderKanban className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-white">Nenhum arquivo encontrado.</p>
        </div>
      ) : (
        <div className="bg-[#111827] border border-[#374151] rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1F2937] border-b border-[#374151] text-xs uppercase tracking-wider text-[#9CA3AF]">
                <th className="px-6 py-4 font-medium">Nome do Arquivo</th>
                <th className="px-6 py-4 font-medium hidden sm:table-cell">Categoria</th>
                <th className="px-6 py-4 font-medium hidden md:table-cell">Data</th>
                <th className="px-6 py-4 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#374151]">
              {filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-[#1F2937]/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-[#0077C8] shrink-0" />
                      <span className="font-medium text-white truncate max-w-[200px] sm:max-w-xs">{file.originalName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-[#374151] text-[#E5E7EB]">
                      {file.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#9CA3AF] hidden md:table-cell">
                    {new Date(file.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a
                      href={file.driveWebViewLink || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center p-2 text-[#0077C8] hover:bg-[#0077C8]/10 rounded-lg transition-colors"
                      title="Abrir no Drive"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};