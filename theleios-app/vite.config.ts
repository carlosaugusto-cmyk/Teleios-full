import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'Ministério Teleios',
          short_name: 'Teleios',
          description: 'Conduzir pessoas a um relacionamento verdadeiro e transformador com Jesus Cristo, por meio da Palavra de Deus, do discipulado, da oração e do cuidado integral.',
          theme_color: '#0A0F1A',
          background_color: '#0A0F1A',
          display: 'standalone',
          orientation: 'portrait-primary',
          id: '/',
          scope: '/',
          start_url: '/',
          lang: 'pt-BR',
          categories: ['lifestyle', 'education', 'social'],
          icons: [
            { src: '/icons/icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any maskable' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
          shortcuts: [
            { name: 'Devocionais Bíblicos', short_name: 'Devocionais', url: '/', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Estudos Bíblicos', short_name: 'Estudos', url: '/estudos', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Perfil', short_name: 'Perfil', url: '/perfil', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackAllowlist: [/^(?!\/__).*/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'teleios-images-cache',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts-cache' },
            },
            {
              urlPattern: /\/api\/.*/i,
              handler: 'NetworkFirst',
              options: { cacheName: 'api-cache', networkTimeoutSeconds: 10 },
            },
          ],
        },
        devOptions: { enabled: true, type: 'module' },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5175,
      proxy: {
        '/api': {
          target: process.env.VITE_API_BASE_URL || 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
