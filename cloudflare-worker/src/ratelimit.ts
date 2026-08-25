import { Context } from 'hono';
import { WorkerEnvironment } from './auth';

// Rate limiter simples em memória e usando KV
// Em produção na borda, Cloudflare Rate Limiting ou Durable Objects são melhores.
// Mas para o projeto, um KV/Memory rate limiter simples:

const memoryCache = new Map<string, { count: number; resetAt: number }>();

export const rateLimiter = (limit: number, windowSecs: number) => {
  return async (c: Context<WorkerEnvironment>, next: () => Promise<void>) => {
    const ip = c.req.header('cf-connecting-ip') || '127.0.0.1';
    const path = new URL(c.req.url).pathname;
    
    // Key única por IP e endpoint base
    const key = `rl_${ip}_${path.split('/')[2] || 'global'}`;
    const now = Date.now();

    let record = memoryCache.get(key);

    if (!record || record.resetAt < now) {
      record = { count: 1, resetAt: now + windowSecs * 1000 };
      memoryCache.set(key, record);
    } else {
      record.count++;
      if (record.count > limit) {
        c.header('Retry-After', String(windowSecs));
        return c.json({ 
          success: false, 
          error: 'Muitas requisições. Rate Limit excedido.' 
        }, 429);
      }
    }

    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(limit - record.count));
    
    await next();
  };
};
