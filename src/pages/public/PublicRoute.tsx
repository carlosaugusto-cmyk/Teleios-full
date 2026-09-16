import React, { useState, useEffect } from 'react';
import { LandingPage } from './LandingPage.tsx';
import { Study, MediaFile, VideoMetadata } from '../../types/index.ts';
import { safeApiFetch } from '../../utils/contentSanitizer.ts';

export default function PublicRoute() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [galeriaFiles, setGaleriaFiles] = useState<MediaFile[]>([]);
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      safeApiFetch<Study[]>('/api/estudos'),
      safeApiFetch<MediaFile[]>('/api/galeria'),
      safeApiFetch<VideoMetadata[]>('/api/videos'),
    ]).then(([e, g, v]) => {
      if (e.success && Array.isArray(e.data)) setStudies(e.data);
      if (g.success && Array.isArray(g.data)) setGaleriaFiles(g.data);
      if (v.success && Array.isArray(v.data)) setVideos(v.data);
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

  return (
    <LandingPage
      studies={studies}
      galeriaFiles={galeriaFiles}
      videos={videos}
      isLoading={isLoading}
    />
  );
}