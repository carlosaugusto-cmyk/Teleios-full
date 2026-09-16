import { Study } from './api';

const STORAGE_KEY_ENABLED = 'teleios_notifications_enabled';
const STORAGE_KEY_LAST_SEEN = 'teleios_last_seen_content_id';

/**
 * Verifica se a API de Notificações é suportada pelo navegador/dispositivo
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Retorna o status atual da permissão de notificações
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Verifica se o usuário permitiu e ativou as notificações
 */
export function isNotificationEnabled(): boolean {
  if (!isNotificationSupported()) return false;
  const permission = Notification.permission;
  const userPref = localStorage.getItem(STORAGE_KEY_ENABLED);
  return permission === 'granted' && userPref !== 'false';
}

/**
 * Solicita permissão ao usuário para receber notificações
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn('[Notifications] Notificações não são suportadas neste dispositivo.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem(STORAGE_KEY_ENABLED, 'true');
      return true;
    } else {
      localStorage.setItem(STORAGE_KEY_ENABLED, 'false');
      return false;
    }
  } catch (err) {
    console.error('[Notifications] Erro ao solicitar permissão:', err);
    return false;
  }
}

/**
 * Dispara uma notificação nativa do sistema/dispositivo (PWA ou navegador)
 */
export async function showContentNotification(study: Study): Promise<void> {
  if (!isNotificationEnabled()) return;

  const title = `📖 Novo ${study.type || 'Devocional'}: ${study.title}`;
  const rawBody = study.summary || (study.content ? study.content.slice(0, 120) : 'Toque para abrir e ler a mensagem de hoje.');
  const body = rawBody.length > 120 ? `${rawBody.slice(0, 117)}...` : rawBody;
  const icon = '/icons/icon-192.png';
  const badge = '/icons/icon-72.png';
  const tag = `teleios-study-${study.id}`;
  const url = `/conteudo/${study.id}`;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon,
          badge,
          tag,
          renotify: true,
          data: { url },
        } as NotificationOptions);
        return;
      }
    }

    // Fallback para Notification de janela direta
    new Notification(title, {
      body,
      icon,
      badge,
      tag,
      data: { url },
    });
  } catch (e) {
    console.warn('[Notifications] Falha ao exibir notificação:', e);
  }
}

/**
 * Verifica se há novos conteúdos e notifica se houver um novo item
 */
export function checkNewContentAndNotify(
  studies: Study[],
  onNewContentFound?: (newStudy: Study) => void
): void {
  if (!Array.isArray(studies) || studies.length === 0) return;

  // Filtrar apenas conteúdos publicados
  const published = studies.filter(
    (s) => s.published === true || s.status === 'PUBLICADO'
  );
  if (published.length === 0) return;

  // Ordenar pelo mais recente
  const sorted = [...published].sort((a, b) => {
    const timeA = new Date(a.scheduledAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.scheduledAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  const latest = sorted[0];
  const lastSeenId = localStorage.getItem(STORAGE_KEY_LAST_SEEN);

  if (!lastSeenId) {
    // Primeira inicialização do usuário: registrar ID mais recente sem disparar alerta retroativo
    localStorage.setItem(STORAGE_KEY_LAST_SEEN, latest.id);
    return;
  }

  if (lastSeenId !== latest.id) {
    // Um novo conteúdo foi detectado!
    localStorage.setItem(STORAGE_KEY_LAST_SEEN, latest.id);
    showContentNotification(latest);
    if (onNewContentFound) {
      onNewContentFound(latest);
    }
  }
}
