import { Context } from 'hono';

export type Bindings = {
  TELEIOS_KV?: KVNamespace;
  JWT_SECRET?: string;
  CF_WORKER_SECRET?: string;
  RUST_GATEWAY_URL?: string;
  RUST_GATEWAY_SECRET?: string;
  BACKEND_URL?: string;
  ALLOWED_ORIGIN?: string;
  TELEIOS_MEDIA: R2Bucket;
  // Durable Object para coordenação do Agent WhatsApp
  AGENT_COORDINATOR: DurableObjectNamespace;
  // Secret compartilhado com o Go Agent para autenticar conexão WebSocket
  AGENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

export type WorkerToken = {
  sub: string;
  username: string;
  role: string;
  exp: number;
};

export type WorkerEnvironment = {
  Bindings: Bindings;
  Variables: { user: WorkerToken };
};

// HMAC / JWT token simple parser and validator
export async function validateWorkerToken(token: string, secret: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSignature = await sign(`${header}.${payload}`, secret);
    
    if (signature !== expectedSignature) return null;

    const base64Payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(paddedPayload));
    if (decoded.exp < Date.now()) return null; // Token expirado

    return decoded; // { sub, username, role, ... }
  } catch {
    return null;
  }
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export const authMiddleware = async (c: Context<WorkerEnvironment>, next: () => Promise<void>) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Acesso negado: Token não fornecido.' }, 401);
  }

  const token = authHeader.split(' ')[1];
  const decoded = await validateWorkerToken(token, c.env.JWT_SECRET || 'change-me');

  if (!decoded) {
    return c.json({ success: false, error: 'Acesso negado: Token inválido ou expirado.' }, 401);
  }

  c.set('user', decoded);
  await next();
};

export const requirePermission = (module: string) => {
  return async (c: Context<WorkerEnvironment>, next: () => Promise<void>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, error: 'Não autenticado.' }, 401);
    }
    
    // Supondo que as permissões estejam no payload (precisaria injetar na geração ou buscar num DB)
    // Para fins do Worker proxy e RBAC leve, vamos assumir que o 'role' ajuda ou mockar o acesso:
    const role = user.role;
    // Se não tivermos permissions no JWT, superadmin tem acesso a tudo, outros dependem
    if (role === 'superadmin' || role === 'admin') {
      await next();
    } else {
      // Para o operador, apenas módulos específicos (mock para ingest, estudos, galeria, etc)
      const allowedOperatorModules = ['ingest', 'estudos', 'galeria', 'videos', 'projetos'];
      if (allowedOperatorModules.includes(module)) {
        await next();
      } else {
        return c.json({ success: false, error: 'Acesso negado ao módulo.' }, 403);
      }
    }
  };
};
