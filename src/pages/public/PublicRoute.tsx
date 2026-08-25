import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingPage } from './LandingPage.tsx';
import { AuthModal } from '../../components/common/AuthModal.tsx';
import { Study, MediaFile, VideoMetadata, AuthSession } from '../../types/index.ts';
import { loadSession } from '../../services/security.service.ts';
import { apiFetch } from '../../services/api.service.ts';

export default function PublicRoute() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [galeriaFiles, setGaleriaFiles] = useState<MediaFile[]>([]);
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = loadSession();
    if (saved) setSession(saved);
    // Load public data
    Promise.all([
      apiFetch('/api/estudos').then(r => r.json()).catch(() => ({ success: false })),
      apiFetch('/api/galeria').then(r => r.json()).catch(() => ({ success: false })),
      apiFetch('/api/videos').then(r => r.json()).catch(() => ({ success: false })),
    ]).then(([e, g, v]) => {
      if (e.success) setStudies(e.data);
      if (g.success) setGaleriaFiles(g.data);
      if (v.success) setVideos(v.data);
    });
  }, []);

  const handleRequestAdmin = () => {
    if (session) {
      navigate('/admin');
    } else {
      setAuthModalOpen(true);
    }
  };

  const handleLoginSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    setAuthModalOpen(false);
    navigate('/admin');
  };

  return (
    <>
      <LandingPage
        studies={studies}
        galeriaFiles={galeriaFiles}
        videos={videos}
        onOpenAdmin={handleRequestAdmin}
      />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}
