import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Registrar Service Worker do PWA para atualizações imediatas e cache offline
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(<App />);
