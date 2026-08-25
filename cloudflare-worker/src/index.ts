import { Hono } from 'hono';
import { Bindings, WorkerEnvironment, authMiddleware, requirePermission, validateWorkerToken } from './auth';
import { rateLimiter } from './ratelimit';
import { makeEnvelope } from './protocol';
import type { Job, Channel } from './protocol';

// Re-export DO so Wrangler finds it
export { AgentCoordinator } from './durable_object';

type MediaFile = Record<string, any>;
type Study = Record<string, any>;
type Video = Record<string, any>;
const app = new Hono<WorkerEnvironment>();
const KEY = {
  files: 'teleios:files',
  studies: 'teleios:studies',
  videos: 'teleios:videos',
  users: 'teleios:users',
  jobs: 'teleios:jobs',
  channels: 'teleios:channels',
};
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const getJson = async <T>(kv: KVNamespace, key: string, fallback: T): Promise<T> => (await kv.get<T>(key, 'json')) ?? fallback;
const putJson = (kv: KVNamespace, key: string, value: unknown) => kv.put(key, JSON.stringify(value));
const safeUser = ({ passwordHash, failedLoginAttempts, ...user }: Record<string, any>) => user;

// Helper: obter stub do Durable Object (singleton por conta)
function getCoordinatorStub(env: Bindings): DurableObjectStub {
  const doId = env.AGENT_COORDINATOR.idFromName('global-coordinator');
  return env.AGENT_COORDINATOR.get(doId);
}

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin'); const allowed = c.env.ALLOWED_ORIGIN || '*';
  c.header('Access-Control-Allow-Origin', allowed === '*' ? '*' : origin === allowed ? origin : allowed);
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Agent-Secret'); c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (c.req.method === 'OPTIONS') return c.body(null, 204); await next();
});
app.use('*', rateLimiter(100, 60));

async function sha256(value: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function sign(value: string, secret: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const result = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)); return btoa(String.fromCharCode(...new Uint8Array(result))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }
const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
async function tokenFor(user: Record<string, any>, secret: string) { const header = encode({ alg: 'HS256', typ: 'JWT' }); const exp = Date.now() + 8 * 60 * 60 * 1000; const payload = encode({ sub: user.id, username: user.username, role: user.role, exp }); return { token: `${header}.${payload}.${await sign(`${header}.${payload}`, secret)}`, expiresAt: new Date(exp).toISOString() }; }
async function bootstrap(env: Bindings) { const users = await getJson<Record<string, any>[]>(env.TELEIOS_KV!, KEY.users, []); if (users.length) return; await putJson(env.TELEIOS_KV!, KEY.users, [{ id: 'user-superadmin-001', username: 'admin', passwordHash: await sha256('admin'), role: 'superadmin', permissions: ['*'], displayName: 'Super Administrador', createdAt: now(), updatedAt: now(), active: true, failedLoginAttempts: 0, lockedUntil: null }]); }

// ─── Rotas existentes (sem alteração) ────────────────────────────────────────

app.get('/health', async (c) => { await bootstrap(c.env); return c.json({ status: 'ok', service: 'teleios-api-worker', storage: 'KV + R2', time: Date.now() }); });
app.post('/api/auth/login', async (c) => { await bootstrap(c.env); const { username, password } = await c.req.json<{ username?: string; password?: string }>(); const users = await getJson<Record<string, any>[]>(c.env.TELEIOS_KV!, KEY.users, []); const user = users.find((item) => item.username === username?.trim().toLowerCase()); if (!user || !user.active || user.passwordHash !== await sha256(password || '')) return c.json({ success: false, error: 'Credenciais inválidas.' }, 401); const session = await tokenFor(user, c.env.JWT_SECRET || 'change-me'); return c.json({ success: true, session: { ...session, user: safeUser(user) } }); });
app.get('/api/auth/me', authMiddleware, async (c) => { const users = await getJson<Record<string, any>[]>(c.env.TELEIOS_KV!, KEY.users, []); const user = users.find((item) => item.id === c.get('user').sub); return user ? c.json({ success: true, user: safeUser(user) }) : c.json({ success: false, error: 'Usuário não encontrado.' }, 404); });

app.get('/api/estudos', async (c) => { await bootstrap(c.env); const [studies, files] = await Promise.all([getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []), getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, [])]); return c.json({ success: true, count: studies.length, data: studies.map((s) => ({ ...s, mediaFile: files.find((f) => f.id === s.fileId) })) }); });
app.get('/api/galeria', async (c) => { await bootstrap(c.env); const files = await getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []); const data = files.filter((f) => f.category === 'GALERIA'); return c.json({ success: true, count: data.length, data }); });
app.get('/api/videos', async (c) => { await bootstrap(c.env); const [videos, files] = await Promise.all([getJson<Video[]>(c.env.TELEIOS_KV!, KEY.videos, []), getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, [])]); return c.json({ success: true, count: videos.length, data: videos.map((v) => ({ ...v, mediaFile: files.find((f) => f.id === v.fileId) })) }); });
app.get('/api/projetos', async (c) => { await bootstrap(c.env); const files = await getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []); const data = files.filter((f) => f.category === 'PROJETO' || f.category === 'APOIO'); return c.json({ success: true, count: data.length, data }); });
app.get('/api/status', async (c) => { await bootstrap(c.env); const [files, studies, videos] = await Promise.all([getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []), getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []), getJson<Video[]>(c.env.TELEIOS_KV!, KEY.videos, [])]); return c.json({ success: true, data: { gemini: { configured: false, model: 'cloudflare-worker', status: 'offline' }, drive: { configured: false, rootFolder: 'R2/teleios-media', status: 'online' }, whastmeo: { configured: false, vpsUrl: '', status: 'standby' }, youtube: { configured: false, status: 'standby' }, scheduler: { nextRuns: [], active: false, cronSchedule: '' }, stats: { totalFiles: files.length, totalStudies: studies.length, whatsappDispatched: studies.filter((s) => s.sentToWhatsapp).length, youtubeVideos: videos.length } } }); });

app.post('/api/upload', authMiddleware, requirePermission('ingest'), async (c) => { await bootstrap(c.env); const form = await c.req.formData(); const category = String(form.get('category') || 'ESTUDO'); const textContent = String(form.get('textContent') || ''); const value = form.get('file'); const file = typeof value === 'string' || !value ? null : value as unknown as File; const fileId = id('file'); const fileName = file?.name || String(form.get('fileName') || 'novo_texto.txt'); const mimeType = file?.type || String(form.get('mimeType') || 'text/plain'); const r2Key = file ? `${fileId}/${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}` : null; if (file && r2Key) await c.env.TELEIOS_MEDIA.put(r2Key, file.stream(), { httpMetadata: { contentType: mimeType } }); const mediaFile: MediaFile = { id: fileId, originalName: fileName, mimeType, size: file?.size || textContent.length, category, driveFileId: r2Key, driveWebViewLink: r2Key ? new URL(`/api/media/${fileId}`, c.req.url).toString() : null, driveFolderPath: 'R2/teleios-media', status: category === 'ESTUDO' ? 'PENDING' : 'COMPLETED', createdAt: now(), r2Key }; const files = await getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []); files.unshift(mediaFile); await putJson(c.env.TELEIOS_KV!, KEY.files, files); if (category === 'ESTUDO') { const studies = await getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []); const study = { id: id('study'), fileId, rawContent: textContent || (file ? await file.text() : ''), summary: null, aiImagePrompt: null, generatedImgUrl: null, scheduledAt: null, sentToWhatsapp: false, sentAt: null, createdAt: now() }; studies.unshift(study); await putJson(c.env.TELEIOS_KV!, KEY.studies, studies); return c.json({ success: true, mediaFile, study, message: 'Estudo publicado com sucesso.' }, 201); } if (category === 'VIDEO') { const videos = await getJson<Video[]>(c.env.TELEIOS_KV!, KEY.videos, []); const video = { id: id('video'), fileId, title: String(form.get('videoTitle') || fileName.replace(/\.[^.]+$/, '')), description: String(form.get('videoDescription') || ''), scheduledAt: null, published: false, youtubeUrl: null }; videos.unshift(video); await putJson(c.env.TELEIOS_KV!, KEY.videos, videos); return c.json({ success: true, mediaFile, videoMetadata: video }, 201); } return c.json({ success: true, mediaFile, message: 'Arquivo publicado com sucesso.' }, 201); });
app.get('/api/media/:id', async (c) => { const files = await getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []); const file = files.find((item) => item.id === c.req.param('id')); if (!file?.r2Key) return c.json({ success: false, error: 'Arquivo não encontrado.' }, 404); const object = await c.env.TELEIOS_MEDIA.get(file.r2Key); if (!object) return c.json({ success: false, error: 'Objeto não encontrado.' }, 404); return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType || file.mimeType, 'Content-Disposition': `inline; filename="${file.originalName}"` } }); });

// ─── Agent WebSocket — proxied para o Durable Object ─────────────────────────
// O Agent conecta em wss://<worker>/api/agent/ws com header X-Agent-Secret
// O painel admin conecta com ?mode=admin e Bearer JWT normal

app.get('/api/agent/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.json({ success: false, error: 'Expected WebSocket upgrade.' }, 426);
  }

  const mode = c.req.query('mode') || 'agent';

  if (mode === 'agent') {
    // Autenticar o Agent pelo secret
    const agentSecret = c.req.header('X-Agent-Secret');
    const expectedSecret = c.env.AGENT_SECRET || '3M7#kL2$vP9!xR4z';
    if (!agentSecret || agentSecret !== expectedSecret) {
      return c.json({ success: false, error: 'Agent secret inválido.' }, 401);
    }
  } else if (mode === 'admin') {
    // Autenticar admin pelo JWT no header ou query string
    const authHeader = c.req.header('Authorization');
    const queryToken = c.req.query('token');

    let token = '';
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (queryToken) {
      token = queryToken;
    }

    if (!token) {
      return c.json({ success: false, error: 'Token não fornecido.' }, 401);
    }

    const user = await validateWorkerToken(token, c.env.JWT_SECRET || 'dev_secret');
    if (!user) return c.json({ success: false, error: 'Token inválido ou expirado.' }, 401);
  } else {
    return c.json({ success: false, error: 'Modo de WebSocket inválido.' }, 400);
  }

  // Redirecionar para o DO
  const stub = getCoordinatorStub(c.env);
  const url = new URL(c.req.url);
  url.searchParams.set('mode', mode);
  return stub.fetch(new Request(url.toString(), c.req.raw));
});

// ─── Status do Agent (HTTP snapshot) ─────────────────────────────────────────

app.get('/api/agent/status', authMiddleware, async (c) => {
  const stub = getCoordinatorStub(c.env);
  const url = new URL(c.req.url);
  url.pathname = '/status';
  const res = await stub.fetch(new Request(url.toString()));
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
});

// ─── Comandos ao Agent ────────────────────────────────────────────────────────

app.post('/api/agent/command', authMiddleware, requirePermission('config'), async (c) => {
  if (c.get('user')?.role !== 'superadmin') {
    return c.json({ success: false, error: 'Apenas superadmin pode controlar o Agent.' }, 403);
  }
  const body = await c.req.json();
  const stub = getCoordinatorStub(c.env);
  const url = new URL(c.req.url);
  url.pathname = '/command';
  const res = await stub.fetch(new Request(url.toString(), { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }));
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
});

// ─── Channels ─────────────────────────────────────────────────────────────────

app.get('/api/channels', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const channels = await getJson<Channel[]>(c.env.TELEIOS_KV!, KEY.channels, []);
  return c.json({ success: true, data: channels });
});

app.post('/api/channels', authMiddleware, requirePermission('config'), async (c) => {
  await bootstrap(c.env);
  const body = await c.req.json<{ name: string; whatsappJid: string; agentId: string }>();
  if (!body.name || !body.whatsappJid || !body.agentId) {
    return c.json({ success: false, error: 'name, whatsappJid e agentId são obrigatórios.' }, 400);
  }
  // Normalizar JID
  const jid = body.whatsappJid.includes('@') ? body.whatsappJid : `${body.whatsappJid}@s.whatsapp.net`;
  const channel: Channel = {
    id: id('ch'),
    name: body.name,
    whatsappJid: jid,
    agentId: body.agentId,
    active: true,
    createdAt: now(),
    updatedAt: now(),
  };
  const channels = await getJson<Channel[]>(c.env.TELEIOS_KV!, KEY.channels, []);
  channels.unshift(channel);
  await putJson(c.env.TELEIOS_KV!, KEY.channels, channels);
  return c.json({ success: true, data: channel }, 201);
});

app.put('/api/channels/:id', authMiddleware, requirePermission('config'), async (c) => {
  await bootstrap(c.env);
  const channels = await getJson<Channel[]>(c.env.TELEIOS_KV!, KEY.channels, []);
  const idx = channels.findIndex((ch) => ch.id === c.req.param('id'));
  if (idx === -1) return c.json({ success: false, error: 'Canal não encontrado.' }, 404);
  const body = await c.req.json<Partial<Channel>>();
  channels[idx] = { ...channels[idx], ...body, updatedAt: now() };
  await putJson(c.env.TELEIOS_KV!, KEY.channels, channels);
  return c.json({ success: true, data: channels[idx] });
});

// ─── Job Queue ────────────────────────────────────────────────────────────────

app.get('/api/jobs', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const jobs = await getJson<Job[]>(c.env.TELEIOS_KV!, KEY.jobs, []);
  const status = c.req.query('status');
  const data = status ? jobs.filter((j) => j.status === status) : jobs;
  return c.json({ success: true, count: data.length, data });
});

app.post('/api/jobs', authMiddleware, requirePermission('estudos'), async (c) => {
  await bootstrap(c.env);
  const body = await c.req.json<{
    studyId: string;
    channelId?: string;
    targetPhone?: string;
    scheduledAt?: string;
    content?: string;
  }>();

  if (!body.studyId || (!body.channelId && !body.targetPhone)) {
    return c.json({ success: false, error: 'studyId e channelId ou targetPhone são obrigatórios.' }, 400);
  }

  // Buscar dados do estudo e do canal
  const [studies, channels] = await Promise.all([
    getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []),
    getJson<Channel[]>(c.env.TELEIOS_KV!, KEY.channels, []),
  ]);

  const study = studies.find((s) => s.id === body.studyId);
  if (!study) return c.json({ success: false, error: 'Estudo não encontrado.' }, 404);

  let recipientJid = '';
  let agentId = 'agent_local_001'; // Default fallback agent

  if (body.channelId) {
    const channel = channels.find((ch) => ch.id === body.channelId && ch.active);
    if (!channel) return c.json({ success: false, error: 'Canal não encontrado ou inativo.' }, 404);
    recipientJid = channel.whatsappJid;
    agentId = channel.agentId;
  } else if (body.targetPhone) {
    recipientJid = body.targetPhone.includes('@') ? body.targetPhone : `${body.targetPhone}@s.whatsapp.net`;
  }

  const content = body.content || study.summary || study.rawContent || '';
  const isScheduled = Boolean(body.scheduledAt);

  const job: Job = {
    id: id('job'),
    studyId: body.studyId,
    channelId: body.channelId || 'direct_message',
    agentId: agentId,
    recipientJid,
    content,
    scheduledAt: body.scheduledAt || null,
    status: isScheduled ? 'PENDING' : 'READY',
    attempts: 0,
    createdAt: now(),
    updatedAt: now(),
  };

  // Persistir no KV
  const jobs = await getJson<Job[]>(c.env.TELEIOS_KV!, KEY.jobs, []);
  jobs.unshift(job);
  await Promise.all([
    putJson(c.env.TELEIOS_KV!, KEY.jobs, jobs),
    putJson(c.env.TELEIOS_KV!, `${KEY.jobs}:${job.id}`, job),
  ]);

  // O DO persiste a cópia operacional e usa alarmes para jobs agendados.
  // Jobs imediatos são despachados na mesma chamada; os agendados ficam prontos
  // automaticamente no horário definido.
  {
    try {
      const stub = getCoordinatorStub(c.env);
      const url = new URL(c.req.url);
      url.pathname = '/dispatch';
      await stub.fetch(new Request(url.toString(), {
        method: 'POST',
        body: JSON.stringify(job),
        headers: { 'Content-Type': 'application/json' },
      }));
    } catch (e) {
      console.error('[Worker] Failed to dispatch to DO:', e);
      // Job permanece persistido no KV; uma nova tentativa ocorrerá no próximo request/registro.
    }
  }

  return c.json({ success: true, data: job }, 201);
});

app.delete('/api/jobs/:id', authMiddleware, requirePermission('estudos'), async (c) => {
  await bootstrap(c.env);
  const jobs = await getJson<Job[]>(c.env.TELEIOS_KV!, KEY.jobs, []);
  const job = jobs.find((j) => j.id === c.req.param('id'));
  if (!job) return c.json({ success: false, error: 'Job não encontrado.' }, 404);
  if (job.status === 'SENT') return c.json({ success: false, error: 'Não é possível cancelar job já enviado.' }, 400);
  const updated = jobs.map((j) => j.id === c.req.param('id') ? { ...j, status: 'CANCELLED' as const, updatedAt: now() } : j);
  await putJson(c.env.TELEIOS_KV!, KEY.jobs, updated);
  return c.json({ success: true });
});

export default app;
