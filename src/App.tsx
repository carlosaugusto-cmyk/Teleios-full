import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import PublicRoute from './pages/public/PublicRoute.tsx';
import DocumentoDetailPage from './pages/public/DocumentoDetailPage.tsx';

function RedirectToDocumento() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/documento/${id || ''}`} replace />;
}

// ============================================================
// ROOT APP — React Router Público Unificado (SPA)
// ============================================================
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page Principal Unificada (SPA) */}
        <Route path="/" element={<PublicRoute />} />

        {/* Única Rota Dinâmica Persistente para Visualização Individual de Documentos/Mídias */}
        <Route path="/documento/:id" element={<DocumentoDetailPage />} />

        {/* Redirecionamentos de Compatibilidade para Links Legados */}
        <Route path="/midias/devocionais/:id" element={<RedirectToDocumento />} />
        <Route path="/midias/videos/:id" element={<RedirectToDocumento />} />
        <Route path="/midias/estudos/:id" element={<RedirectToDocumento />} />

        {/* Rotas de listagem antigas e admin redirecionam para o início */}
        <Route path="/midias/*" element={<Navigate to="/" replace />} />
        <Route path="/admin/*" element={<Navigate to="/" replace />} />
        <Route path="/admin" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />

        {/* Fallback Global */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}