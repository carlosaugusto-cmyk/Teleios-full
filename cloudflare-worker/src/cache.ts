import { Context } from 'hono';
import { WorkerEnvironment } from './auth';

/**
 * Middleware de Cache usando Cloudflare KV
 * Ideal para rotas de leitura (/api/estudos, /api/videos)
 */
export const kvCache = (ttlSeconds: number) => {
  return async (c: Context<WorkerEnvironment>, next: () => Promise<void>) => {
    // Apenas requisições GET
    if (c.req.method !== 'GET') {
      return await next();
    }

    const kv = c.env.TELEIOS_KV;
    if (!kv) {
      console.warn('TELEIOS_KV não está bindado. Ignorando cache.');
      return await next();
    }

    const key = `cache:${new URL(c.req.url).pathname}`;
    const cached = await kv.get(key, 'text');

    if (cached) {
      c.header('X-Cache', 'HIT');
      c.header('Content-Type', 'application/json');
      return c.body(cached);
    }

    // Se não tiver cache, prossegue
    await next();

    // Após processar, se foi sucesso (200), guarda no cache
    if (c.res.status === 200) {
      const responseClone = c.res.clone();
      const text = await responseClone.text();
      // Em background, salva no KV sem travar a response
      c.executionCtx.waitUntil(kv.put(key, text, { expirationTtl: ttlSeconds }));
      c.header('X-Cache', 'MISS');
    }
  };
};

/**
 * Invalida chaves de cache relacionadas a um módulo após mutação
 */
export async function invalidateCache(kv: KVNamespace | undefined, prefix: string) {
  if (!kv) return;
  // O KV do Cloudflare não tem deleteByPrefix nativo fácil (precisa listar e deletar).
  // Para fins simples, vamos invalidar a chave exata principal.
  await kv.delete(`cache:/api/${prefix}`);
}
