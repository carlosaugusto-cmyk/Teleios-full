import { loadSession } from './security.service.ts';

const productionApiUrl = 'https://teleios-api-worker.ca88321499.workers.dev';
const configuredApiUrl = import.meta.env.VITE_API_BASE_URL;

/**
 * Resolves API paths against the Cloudflare Worker in production. In local
 * development, requests stay on the same origin unless VITE_API_BASE_URL is set.
 */
export function apiUrl(path: string): string {
  const baseUrl = configuredApiUrl || (import.meta.env.PROD ? productionApiUrl : '');
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path;
}

/** Fetch helper that automatically attaches Bearer token if session exists. */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = loadSession();
  const headers = new Headers(init.headers);

  if (session?.token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${session.token}`);
  }

  return fetch(apiUrl(path), { ...init, headers });
}
