import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PublicRoute from './pages/public/PublicRoute.tsx';
import AdminRoute from './pages/admin/AdminRoute.tsx';
import MidiasPage from './pages/public/MidiasPage.tsx';

// ============================================================
// ROOT APP — React Router setup
// ============================================================
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicRoute />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="/midias" element={<MidiasPage />} />
        <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
