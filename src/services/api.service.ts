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

/** Fetch helper for public API requests. */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  return fetch(apiUrl(path), { ...init, headers });
}
