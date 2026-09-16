import { Hono } from 'hono';
import { Bindings, WorkerEnvironment, authMiddleware, requirePermission, validateWorkerToken } from './auth';
import { rateLimiter } from './ratelimit';
import { makeEnvelope } from './protocol';
import type { Job, Channel } from './protocol';
import {
  testGoogleDriveConnection,
  listGoogleDriveFiles,
  getGoogleDriveFile,
  downloadGoogleDriveFileContent,
  uploadFileToGoogleDrive,
  buildGoogleOAuthUrl,
  exchangeOAuthCodeForTokens,
  revokeGoogleToken,
  fetchDriveAbout,
  GoogleDriveCredentials,
} from './drive';

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
  appUsers: 'teleios:app_users',
  financialExpenses: 'teleios:financial_expenses',
  jobs: 'teleios:jobs',
  channels: 'teleios:channels',
  backup: 'teleios:backup_status',
  backupQueue: 'teleios:backup_queue',
  leads: 'teleios:leads',
  config: 'teleios:config',
};

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const getJson = async <T>(kv: KVNamespace, key: string, fallback: T): Promise<T> => {
  try {
    if (!kv) return fallback;
    const val = await kv.get<T>(key, 'json');
    return val ?? fallback;
  } catch (e) {
    console.error(`[KV Error] key=${key}`, e);
    return fallback;
  }
};

const putJson = (kv: KVNamespace, key: string, value: unknown) => kv.put(key, JSON.stringify(value));

const enqueueBackup = async (kv: KVNamespace, item: any) => {
  try {
    if (!kv) return;
    const queue = await getJson<any[]>(kv, KEY.backupQueue, []);
    queue.push(item);
    if (queue.length > 500) queue.shift();
    await putJson(kv, KEY.backupQueue, queue);
  } catch (err) {
    console.error('[Backup Queue Error]', err);
  }
};
const safeUser = ({ passwordHash, failedLoginAttempts, ...user }: Record<string, any>) => user;

// Helper: obter stub do Durable Object (singleton por conta)
function getCoordinatorStub(env: Bindings): DurableObjectStub {
  const doId = env.AGENT_COORDINATOR.idFromName('global-coordinator');
  return env.AGENT_COORDINATOR.get(doId);
}

// ─── Middleware Global de CORS ────────────────────────────────────────────────
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  
  let allowOrigin = '*';
  if (origin) {
    if (
      origin === 'https://teleios-platform.pages.dev' ||
      origin.endsWith('.pages.dev') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin === c.env.ALLOWED_ORIGIN
    ) {
      allowOrigin = origin;
    } else if (c.env.ALLOWED_ORIGIN && c.env.ALLOWED_ORIGIN !== '*') {
      allowOrigin = c.env.ALLOWED_ORIGIN;
    } else {
      allowOrigin = origin;
    }
  }

  c.header('Access-Control-Allow-Origin', allowOrigin);
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  const requestedHeaders = c.req.header('Access-Control-Request-Headers');
  const allowHeaders = requestedHeaders
    ? `Authorization, Content-Type, X-Agent-Secret, Accept, Origin, X-Requested-With, X-App-Admin-Phone, x-app-admin-phone, X-App-Admin-User, x-app-admin-user, ${requestedHeaders}`
    : 'Authorization, Content-Type, X-Agent-Secret, Accept, Origin, X-Requested-With, X-App-Admin-Phone, x-app-admin-phone, X-App-Admin-User, x-app-admin-user, *';
  c.header('Access-Control-Allow-Headers', allowHeaders);
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Max-Age', '86400');

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  await next();
});

// ─── Handlers Globais com Garantia de CORS em Erros e 404 ─────────────────────
app.onError((err, c) => {
  console.error('[Worker Error]', err);
  const origin = c.req.header('Origin') || '*';
  return c.json(
    { success: false, error: err.message || 'Erro interno no servidor.' },
    500,
    {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Agent-Secret, Accept, Origin, X-Requested-With, X-App-Admin-Phone, x-app-admin-phone, X-App-Admin-User, x-app-admin-user, *',
    }
  );
});

app.notFound((c) => {
  const origin = c.req.header('Origin') || '*';
  return c.json(
    { success: false, error: 'Endpoint não encontrado.' },
    404,
    {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Agent-Secret, Accept, Origin, X-Requested-With, X-App-Admin-Phone, x-app-admin-phone, X-App-Admin-User, x-app-admin-user, *',
    }
  );
});

app.use('*', rateLimiter(150, 60));

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const result = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(result))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

async function tokenFor(user: Record<string, any>, secret: string) {
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const exp = Date.now() + 8 * 60 * 60 * 1000;
  const payload = encode({ sub: user.id, username: user.username, role: user.role, exp });
  return { token: `${header}.${payload}.${await sign(`${header}.${payload}`, secret)}`, expiresAt: new Date(exp).toISOString() };
}

async function bootstrap(env: Bindings) {
  if (!env.TELEIOS_KV) return;
  const users = await getJson<Record<string, any>[]>(env.TELEIOS_KV, KEY.users, []);
  if (!users || users.length === 0) {
    await putJson(env.TELEIOS_KV, KEY.users, [
      {
        id: 'user-superadmin-001',
        username: 'admin',
        passwordHash: await sha256('admin'),
        role: 'superadmin',
        permissions: ['*'],
        displayName: 'Super Administrador',
        createdAt: now(),
        updatedAt: now(),
        active: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    ]);
  }

  const cfg = await getJson<any>(env.TELEIOS_KV, KEY.config, null);
  if (!cfg) {
    await putJson(env.TELEIOS_KV, KEY.config, {
      pix: {
        key: 'pix@ministerioteleios.com.br',
        keyType: 'email',
        receiverName: 'MINISTERIO TELEIOS',
        receiverCity: 'SAO PAULO',
        description: 'Doacao Ministerio Teleios',
      },
      gemini: {
        apiKey: '',
        model: 'gemini-1.5-flash',
        configured: false,
        status: 'offline',
      },
      googleDrive: {
        serviceAccountEmail: '',
        rootFolderId: '',
        rootFolderName: 'Teleios_Backup',
        configured: false,
        status: 'offline',
      },
    });
  }

  const seededStudies = await env.TELEIOS_KV.get('teleios:seeded_initial_studies');
  if (!seededStudies) {
    const currentStudies = await getJson<Study[]>(env.TELEIOS_KV, KEY.studies, []);
    if (!currentStudies || currentStudies.length === 0) {
      await putJson(env.TELEIOS_KV, KEY.studies, [
        {
          id: 'study-devocional-0309',
          fileId: 'file-devocional-0309',
          title: 'DEVOCIONAL 03/09 (QUINTA-FEIRA) - TEMA: Não ofereça fogo estranho',
          type: 'Devocional',
          status: 'PUBLICADO',
          published: true,
          rawContent: 'DEVOCIONAL 03/09 (QUINTA-FEIRA) - TEMA: Não ofereça fogo estranho\n\nTexto bíblico: Levítico 10:1-2\n\nNa caminhada cristã, devemos nos achegar a Deus com reverência e obediência à Sua Palavra. Nadabe e Abiú ofereceram fogo estranho diante do Senhor, o que Ele não lhes havia ordenado. O verdadeiro culto é aquele oferecido em espírito e em verdade, alinhado à vontade soberana de Deus e movido pelo Espírito Santo. Não ofereça fogo estranho em suas decisões, orações e adoração; busque a pureza do altar do Senhor.',
          content: 'DEVOCIONAL 03/09 (QUINTA-FEIRA) - TEMA: Não ofereça fogo estranho\n\nTexto bíblico: Levítico 10:1-2\n\nNa caminhada cristã, devemos nos achegar a Deus com reverência e obediência à Sua Palavra. Nadabe e Abiú ofereceram fogo estranho diante do Senhor, o que Ele não lhes havia ordenado. O verdadeiro culto é aquele oferecido em espírito e em verdade, alinhado à vontade soberana de Deus e movido pelo Espírito Santo. Não ofereça fogo estranho em suas decisões, orações e adoração; busque a pureza do altar do Senhor.',
          summary: 'Devocional sobre adoração sincera e reverência a Deus: não ofereça fogo estranho diante do Senhor, mas busque a santidade e a verdade da Palavra.',
          topic: 'Santidade & Reverência',
          aiImagePrompt: null,
          generatedImgUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=80',
          aiImageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=80',
          scheduledAt: null,
          sentToWhatsapp: false,
          sentAt: null,
          createdAt: now(),
          updatedAt: now(),
        },
        {
          id: 'study-01',
          fileId: 'file-estudo-01',
          title: 'Maturidade Cristã (Efésios 4:13)',
          type: 'Estudo',
          status: 'PUBLICADO',
          published: true,
          rawContent: 'Estudo bíblico sobre o chamado à maturidade cristã baseado em Efésios 4:13. O apóstolo Paulo nos exorta a crescermos até que todos alcancemos a medida da estatura da plenitude de Cristo.',
          content: 'Estudo bíblico sobre o chamado à maturidade cristã baseado em Efésios 4:13. O apóstolo Paulo nos exorta a crescermos até que todos alcancemos a medida da estatura da plenitude de Cristo.',
          summary: 'A maturidade cristã não é um destino, mas uma jornada contínua de transformação pelo poder da Palavra.',
          topic: 'Discipulado',
          aiImagePrompt: null,
          generatedImgUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
          aiImageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
          scheduledAt: null,
          sentToWhatsapp: true,
          sentAt: now(),
          createdAt: now(),
          updatedAt: now(),
        },
      ]);
    }
    await env.TELEIOS_KV.put('teleios:seeded_initial_studies', 'true');
  }

  // Auto-migração e cura de documentos em estudos salvos no KV
  try {
    const allFiles = await getJson<MediaFile[]>(env.TELEIOS_KV, KEY.files, []);
    const currentStudies = await getJson<Study[]>(env.TELEIOS_KV, KEY.studies, []);
    if (allFiles && allFiles.length > 0 && currentStudies && currentStudies.length > 0) {
      let modified = false;
      const healedStudies = currentStudies.map((s: any) => {
        const enriched = enrichStudyWithDocument({ ...s, documentUrl: null }, allFiles);
        if (enriched.documentUrl && (s.documentUrl !== enriched.documentUrl || s.documentName !== enriched.documentName)) {
          modified = true;
          return enriched;
        }
        return s;
      });
      if (modified) {
        await putJson(env.TELEIOS_KV, KEY.studies, healedStudies);
      }
    }
  } catch (err) {
    console.warn('[AutoHeal Documents Warning]', err);
  }
}

function enrichStudyWithDocument(s: any, files: MediaFile[]): any {
  let docUrl = s.documentUrl || null;
  let docName = s.documentName || null;
  let docType = s.documentType || null;
  let docSize = s.documentSize || null;

  if (!docUrl || !docName || docName === 'Arquivo') {
    const fullText = `${s.content || ''} ${s.rawContent || ''}`;
    const docMatch = fullText.match(/Documento anexado:\s*([^\r\n]+)/i);
    const targetDocName = docMatch ? docMatch[1].trim() : null;

    let matchedFile: MediaFile | undefined;
    if (targetDocName) {
      const cleanTarget = targetDocName.toLowerCase().replace(/[_\s-]+/g, ' ').trim();
      matchedFile = files.find((f) => {
        const cleanFile = (f.originalName || '').toLowerCase().replace(/[_\s-]+/g, ' ').trim();
        return cleanFile === cleanTarget || (f.originalName && f.originalName.toLowerCase() === targetDocName.toLowerCase());
      });
    }

    if (!matchedFile) {
      matchedFile = files.find((f) => {
        if (f.category === 'DOCUMENTO' && Math.abs(new Date(f.createdAt).getTime() - new Date(s.createdAt).getTime()) < 60000) return true;
        return false;
      });
    }

    if (matchedFile) {
      docUrl = matchedFile.driveWebViewLink || (matchedFile.r2Key ? `/api/media/${matchedFile.id}` : (matchedFile.id ? `/api/media/${matchedFile.id}` : null));
      docName = matchedFile.originalName;
      docSize = matchedFile.size;
      const ext = (matchedFile.originalName || '').split('.').pop()?.toLowerCase() || '';
      docType = ext === 'pdf' ? 'pdf' : (ext === 'docx' ? 'docx' : (ext === 'doc' ? 'doc' : 'documento'));
    }
  }

  return {
    ...s,
    documentUrl: docUrl,
    documentName: docName,
    documentType: docType,
    documentSize: docSize,
  };
}

// ─── Health & Auth ────────────────────────────────────────────────────────────

app.get('/health', async (c) => {
  await bootstrap(c.env);
  return c.json({ status: 'ok', service: 'teleios-api-worker', storage: 'KV + R2', time: Date.now() });
});

app.post('/api/auth/login', async (c) => {
  await bootstrap(c.env);
  const { username, password } = await c.req.json<{ username?: string; password?: string }>();
  const users = await getJson<Record<string, any>[]>(c.env.TELEIOS_KV!, KEY.users, []);
  const user = users.find((item) => item.username === username?.trim().toLowerCase());
  if (!user || !user.active || user.passwordHash !== (await sha256(password || ''))) {
    return c.json({ success: false, error: 'Credenciais inválidas.' }, 401);
  }
  const session = await tokenFor(user, c.env.JWT_SECRET || 'change-me');
  return c.json({ success: true, session: { ...session, user: safeUser(user) } });
});

app.get('/api/auth/me', authMiddleware, async (c) => {
  const users = await getJson<Record<string, any>[]>(c.env.TELEIOS_KV!, KEY.users, []);
  const user = users.find((item) => item.id === c.get('user').sub);
  return user ? c.json({ success: true, user: safeUser(user) }) : c.json({ success: false, error: 'Usuário não encontrado.' }, 404);
});

// ─── Estudos & Devocionais (CRUD Completo) ─────────────────────────────────────

// Listagem de conteúdos: público recebe apenas os PUBLICADOS por padrão; com ?all=true retorna todos para o Admin
app.get('/api/estudos', async (c) => {
  await bootstrap(c.env);
  const showAll = c.req.query('all') === 'true';
  const [studiesRaw, filesRaw, videosRaw, deletedIdsRaw] = await Promise.all([
    getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []),
    getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []),
    showAll ? getJson<any[]>(c.env.TELEIOS_KV!, KEY.videos, []) : Promise.resolve([]),
    getJson<string[]>(c.env.TELEIOS_KV!, 'teleios:deleted_ids', []),
  ]);
  const deletedSet = new Set(Array.isArray(deletedIdsRaw) ? deletedIdsRaw : []);
  const studies = (Array.isArray(studiesRaw) ? studiesRaw : []).filter(
    (s) => !deletedSet.has(s.id) && (!s.fileId || !deletedSet.has(s.fileId))
  );
  const files = (Array.isArray(filesRaw) ? filesRaw : []).filter((f) => !deletedSet.has(f.id));
  const videos = (Array.isArray(videosRaw) ? videosRaw : []).filter(
    (v) => !deletedSet.has(v.id) && (!v.fileId || !deletedSet.has(v.fileId))
  );

  const nowMs = Date.now();
  let studiesModified = false;
  studies.forEach((s) => {
    if ((s.status === 'AGENDADO' || !s.published) && s.scheduledAt && new Date(s.scheduledAt).getTime() <= nowMs) {
      s.status = 'PUBLICADO';
      s.published = true;
      studiesModified = true;
    }
  });
  if (studiesModified) {
    putJson(c.env.TELEIOS_KV!, KEY.studies, studies).catch(() => {});
  }

  let data = studies.map((rawS) => {
    const s = enrichStudyWithDocument(rawS, files);
    const file = files.find((f) => f.id === s.fileId) || files.find((f) => f.originalName === s.documentName);
    const isFuture = Boolean(s.scheduledAt && new Date(s.scheduledAt).getTime() > nowMs);
    const status = isFuture ? 'AGENDADO' : (s.status || (s.published === false ? 'RASCUNHO' : 'PUBLICADO'));
    const isPublished = isFuture ? false : (status === 'PUBLICADO' || s.published === true);

    // Para a listagem em lote, otimizar payload evitando trafegar megabytes de binários
    const rawContentStr = typeof s.rawContent === 'string' ? s.rawContent : '';
    const rawContentList = rawContentStr.length > 1000 ? rawContentStr.slice(0, 1000) : rawContentStr;

    return {
      ...s,
      rawContent: rawContentList,
      title: s.title || file?.originalName?.replace(/\.[^.]+$/, '') || 'Conteúdo',
      type: s.type || 'Devocional',
      status,
      published: isPublished,
      mediaFile: file,
      thumbnailUrl: s.thumbnailUrl || (file?.thumbnailKey ? `/api/media/${file.id}?variant=thumbnail` : null),
    };
  });

  if (showAll && videos.length > 0) {
    const videoItems = videos.map((v) => {
      const file = files.find((f) => f.id === v.fileId);
      const status = v.status || (v.published ? 'PUBLICADO' : 'RASCUNHO');
      return {
        id: v.id,
        fileId: v.fileId || file?.id,
        title: v.title || file?.originalName?.replace(/\.[^.]+$/, '') || 'Vídeo',
        type: 'Vídeo',
        status,
        published: v.published ?? true,
        rawContent: v.description || '',
        content: v.description || '',
        summary: v.description || '',
        videoUrl: v.youtubeUrl || file?.driveWebViewLink || (file?.youtubeVideoId ? `https://www.youtube.com/watch?v=${file.youtubeVideoId}` : undefined),
        generatedImgUrl: file?.driveWebViewLink,
        mediaFile: file,
        scheduledAt: v.scheduledAt || null,
        createdAt: v.createdAt || file?.createdAt || now(),
        updatedAt: v.updatedAt || now(),
      };
    });
    data = [...data, ...videoItems];
  }

  if (showAll && files.length > 0) {
    const existingFileIds = new Set<string>();
    studies.forEach((s) => {
      if (s.fileId) existingFileIds.add(s.fileId);
      if (s.id) existingFileIds.add(s.id);
    });
    videos.forEach((v) => {
      if (v.fileId) existingFileIds.add(v.fileId);
      if (v.id) existingFileIds.add(v.id);
    });

    // Apenas documentos avulsos (NÃO fotos da galeria ou mídias soltas)
    const standaloneFiles = files.filter(
      (f) =>
        !existingFileIds.has(f.id) &&
        !deletedSet.has(f.id) &&
        (f.category === 'DOCUMENTO' || f.category === 'ESTUDO' || f.category === 'DEVOCIONAL' || /\.(pdf|docx?)$/i.test(f.originalName || ''))
    );
    const fileItems = standaloneFiles.map((f) => {
      const ext = (f.originalName || '').split('.').pop()?.toLowerCase() || '';
      const isDoc = f.category === 'DOCUMENTO' || ext === 'pdf' || ext === 'docx' || ext === 'doc';
      const type = isDoc ? 'Documento' : (f.category === 'PROJETO' ? 'Documento' : 'Estudo');
      const docUrl = isDoc ? (f.driveWebViewLink || (f.r2Key ? `/api/media/${f.id}` : (f.id ? `/api/media/${f.id}` : null))) : null;

      return {
        id: f.id,
        fileId: f.id,
        title: f.originalName?.replace(/\.[^.]+$/, '') || 'Arquivo',
        type,
        status: 'PUBLICADO',
        published: true,
        rawContent: f.originalName || '',
        content: f.originalName || '',
        summary: `Arquivo anexado (${(f.size ? (f.size / 1024).toFixed(1) + ' KB' : '')})`,
        generatedImgUrl: null,
        aiImageUrl: null,
        documentUrl: docUrl,
        documentName: f.originalName,
        documentType: ext === 'pdf' ? 'pdf' : (ext === 'docx' ? 'docx' : (ext === 'doc' ? 'doc' : 'documento')),
        documentSize: f.size,
        mediaFile: f,
        scheduledAt: null,
        sentToWhatsapp: false,
        sentAt: null,
        aiImagePrompt: null,
        createdAt: f.createdAt || now(),
        updatedAt: f.updatedAt || now(),
      };
    });
    data = [...data, ...fileItems];
  }

  if (!showAll) {
    data = data.filter((s: any) => {
      if (s.scheduledAt && new Date(s.scheduledAt).getTime() > nowMs) return false;
      if (s.status === 'PUBLICADO' || s.published === true) return true;
      if (s.status === 'AGENDADO' && s.scheduledAt && new Date(s.scheduledAt).getTime() <= nowMs) return true;
      return false;
    });
  }

  return c.json({ success: true, count: data.length, data });
});

// Obter conteúdo único por ID ou slug
app.get('/api/estudos/:id', async (c) => {
  await bootstrap(c.env);
  const idParam = c.req.param('id');
  const [studiesRaw, filesRaw, deletedIdsRaw] = await Promise.all([
    getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []),
    getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []),
    getJson<string[]>(c.env.TELEIOS_KV!, 'teleios:deleted_ids', []),
  ]);
  const deletedSet = new Set(Array.isArray(deletedIdsRaw) ? deletedIdsRaw : []);
  if (deletedSet.has(idParam)) {
    return c.json({ success: false, error: 'Conteúdo não encontrado.' }, 404);
  }

  const studies = (Array.isArray(studiesRaw) ? studiesRaw : []).filter(
    (item) => !deletedSet.has(item.id) && (!item.fileId || !deletedSet.has(item.fileId))
  );
  const files = (Array.isArray(filesRaw) ? filesRaw : []).filter((f) => !deletedSet.has(f.id));

  let s = studies.find((item) => item.id === idParam || item.slug === idParam);
  if (s) {
    s = enrichStudyWithDocument(s, files);
  }
  let file = s ? (files.find((f) => f.id === s.fileId) || files.find((f) => f.originalName === s.documentName)) : undefined;

  if (!s) {
    const videosRaw = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.videos, []);
    const videos = Array.isArray(videosRaw) ? videosRaw : [];
    const v = videos.find((item) => item.id === idParam);
    if (v) {
      file = files.find((f) => f.id === v.fileId);
      const status = v.status || (v.published ? 'PUBLICADO' : 'RASCUNHO');
      const data = {
        id: v.id,
        fileId: v.fileId || file?.id,
        title: v.title || file?.originalName?.replace(/\.[^.]+$/, '') || 'Vídeo',
        type: 'Vídeo',
        status,
        published: v.published ?? true,
        rawContent: v.description || '',
        content: v.description || '',
        summary: v.description || '',
        videoUrl: v.youtubeUrl || file?.driveWebViewLink || (file?.youtubeVideoId ? `https://www.youtube.com/watch?v=${file.youtubeVideoId}` : undefined),
        generatedImgUrl: file?.driveWebViewLink,
        mediaFile: file,
        scheduledAt: v.scheduledAt || null,
        createdAt: v.createdAt || file?.createdAt || now(),
        updatedAt: v.updatedAt || now(),
      };
      return c.json({ success: true, data });
    }

    const f = files.find((item) => item.id === idParam);
    if (f) {
      const isImg =
        !f.category ||
        f.category === 'GALERIA' ||
        f.category === 'IMAGEM' ||
        f.mimeType?.startsWith('image/') ||
        /\.(jpe?g|png|gif|webp|svg|bmp|avif)$/i.test(f.originalName || '');
      const isAud = f.mimeType?.startsWith('audio/') || f.category === 'APOIO';
      const ext = (f.originalName || '').split('.').pop()?.toLowerCase() || '';
      const isDoc = f.category === 'DOCUMENTO' || ext === 'pdf' || ext === 'docx' || ext === 'doc';
      const type = isImg ? 'Imagem' : isAud ? 'Áudio' : isDoc ? 'Documento' : (f.category === 'PROJETO' ? 'Documento' : 'Estudo');
      const imgUrl = isImg ? (f.driveWebViewLink || (f.r2Key ? `/api/media/${f.id}` : (f.id ? `/api/media/${f.id}` : ''))) : null;
      const docUrl = isDoc ? (f.driveWebViewLink || (f.r2Key ? `/api/media/${f.id}` : (f.id ? `/api/media/${f.id}` : null))) : null;
      const data = {
        id: f.id,
        fileId: f.id,
        title: f.originalName?.replace(/\.[^.]+$/, '') || 'Arquivo',
        type,
        status: 'PUBLICADO',
        published: true,
        rawContent: f.originalName || '',
        content: f.originalName || '',
        summary: isImg ? 'Foto / Imagem enviada' : `Arquivo enviado (${(f.size ? (f.size / 1024).toFixed(1) + ' KB' : '')})`,
        generatedImgUrl: imgUrl,
        aiImageUrl: imgUrl,
        documentUrl: docUrl,
        documentName: f.originalName,
        documentType: ext === 'pdf' ? 'pdf' : (ext === 'docx' ? 'docx' : (ext === 'doc' ? 'doc' : 'documento')),
        documentSize: f.size,
        mediaFile: f,
        scheduledAt: null,
        createdAt: f.createdAt || now(),
        updatedAt: f.updatedAt || now(),
      };
      return c.json({ success: true, data });
    }

    return c.json({ success: false, error: 'Conteúdo não encontrado.' }, 404);
  }

  const status = s.status || (s.published === false ? 'RASCUNHO' : 'PUBLICADO');
  const isPublished = status === 'PUBLICADO' || s.published === true;

  const data = {
    ...s,
    title: s.title || file?.originalName?.replace(/\.[^.]+$/, '') || 'Conteúdo',
    type: s.type || 'Devocional',
    status,
    published: isPublished,
    mediaFile: file,
  };

  return c.json({ success: true, data });
});

// Criar novo conteúdo diretamente (Admin)
app.post('/api/estudos', authMiddleware, requirePermission('estudos'), async (c) => {
  await bootstrap(c.env);
  const body = await c.req.json<{
    title: string;
    type?: string;
    status?: string;
    rawContent?: string;
    content?: string;
    summary?: string;
    topic?: string;
    generatedImgUrl?: string;
    videoUrl?: string;
    scheduledAt?: string;
    targetPhone?: string;
  }>();

  if (!body.title?.trim()) {
    return c.json({ success: false, error: 'Título é obrigatório.' }, 400);
  }

  const nowMs = Date.now();
  const isFutureScheduled = Boolean(body.scheduledAt && new Date(body.scheduledAt).getTime() > nowMs);
  const status = isFutureScheduled ? 'AGENDADO' : (body.status || 'PUBLICADO');
  const isPublished = isFutureScheduled ? false : (status === 'PUBLICADO');
  const studyId = id('study');

  const newStudy: Study = {
    id: studyId,
    fileId: `text_${studyId}`,
    title: body.title.trim(),
    type: body.type || 'Devocional',
    status,
    published: isPublished,
    rawContent: body.rawContent || body.content || '',
    content: body.content || body.rawContent || '',
    summary: body.summary || null,
    topic: body.topic || null,
    aiImagePrompt: null,
    generatedImgUrl: body.generatedImgUrl || null,
    thumbnailUrl: (body as any).thumbnailUrl || null,
    documentUrl: (body as any).documentUrl || null,
    documentName: (body as any).documentName || null,
    documentType: (body as any).documentType || null,
    documentSize: (body as any).documentSize || null,
    videoUrl: body.videoUrl || null,
    scheduledAt: body.scheduledAt || null,
    sentToWhatsapp: false,
    sentAt: null,
    createdAt: now(),
    updatedAt: now(),
  };

  const studies = await getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []);
  studies.unshift(newStudy);
  await putJson(c.env.TELEIOS_KV!, KEY.studies, studies);

  // Enfileirar na fila de backup incremental assíncrono (sem travar requisição)
  enqueueBackup(c.env.TELEIOS_KV!, {
    id: newStudy.id,
    type: 'CONTENT',
    title: newStudy.title,
    contentType: newStudy.type || 'Devocional',
    createdAt: newStudy.createdAt,
  }).catch(() => {});

  return c.json({ success: true, data: newStudy, message: 'Conteúdo salvo com sucesso.' }, 201);
});

// Atualizar conteúdo existente (Admin)
app.put('/api/estudos/:id', authMiddleware, requirePermission('estudos'), async (c) => {
  await bootstrap(c.env);
  const studyId = c.req.param('id');
  const body = await c.req.json<Partial<Study>>();

  const studies = await getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []);
  const idx = studies.findIndex((s) => s.id === studyId);
  if (idx === -1) {
    const videos = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.videos, []);
    const vIdx = videos.findIndex((v) => v.id === studyId);
    if (vIdx !== -1) {
      videos[vIdx] = {
        ...videos[vIdx],
        title: body.title !== undefined ? body.title : videos[vIdx].title,
        description: body.content !== undefined ? body.content : (body.rawContent !== undefined ? body.rawContent : (body.summary !== undefined ? body.summary : videos[vIdx].description)),
        youtubeUrl: (body as any).videoUrl !== undefined ? (body as any).videoUrl : videos[vIdx].youtubeUrl,
        status: body.status !== undefined ? body.status : videos[vIdx].status,
        published: body.published !== undefined ? body.published : videos[vIdx].published,
        scheduledAt: body.scheduledAt !== undefined ? body.scheduledAt : videos[vIdx].scheduledAt,
        updatedAt: now(),
      };
      await putJson(c.env.TELEIOS_KV!, KEY.videos, videos);
      return c.json({ success: true, data: videos[vIdx], message: 'Vídeo atualizado com sucesso.' });
    }

    const files = await getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []);
    const fIdx = files.findIndex((f) => f.id === studyId);
    if (fIdx !== -1) {
      files[fIdx] = {
        ...files[fIdx],
        originalName: body.title !== undefined ? body.title : files[fIdx].originalName,
        status: (body.status as any) !== undefined ? (body.status as any) : files[fIdx].status,
        updatedAt: now(),
      };
      await putJson(c.env.TELEIOS_KV!, KEY.files, files);
      return c.json({ success: true, data: files[fIdx], message: 'Arquivo atualizado com sucesso.' });
    }

    return c.json({ success: false, error: 'Conteúdo não encontrado.' }, 404);
  }

  const existing = studies[idx];
  const nowIso = now();
  const nowMs = Date.now();
  const scheduledAt = body.scheduledAt !== undefined ? body.scheduledAt : existing.scheduledAt;
  const isFutureScheduled = Boolean(scheduledAt && new Date(scheduledAt).getTime() > nowMs);
  const newStatus = isFutureScheduled ? 'AGENDADO' : (body.status || existing.status || 'PUBLICADO');
  const isPublished = isFutureScheduled ? false : (newStatus === 'PUBLICADO');

  const updated: Study = {
    ...existing,
    ...body,
    scheduledAt,
    status: newStatus,
    published: isPublished,
    updatedAt: nowIso,
  };

  studies[idx] = updated;
  await putJson(c.env.TELEIOS_KV!, KEY.studies, studies);

  // Enfileirar na fila de backup incremental assíncrono
  enqueueBackup(c.env.TELEIOS_KV!, {
    id: updated.id,
    type: 'CONTENT',
    title: updated.title,
    contentType: updated.type || 'Devocional',
    updatedAt: updated.updatedAt,
  }).catch(() => {});

  return c.json({ success: true, data: updated, message: 'Conteúdo atualizado com sucesso.' });
});

// Excluir conteúdo (Admin)
app.delete('/api/estudos/:id', authMiddleware, requirePermission('estudos'), async (c) => {
  await bootstrap(c.env);
  const studyId = c.req.param('id');
  const [studiesRaw, filesRaw, videosRaw, deletedIdsRaw] = await Promise.all([
    getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []),
    getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []),
    getJson<any[]>(c.env.TELEIOS_KV!, KEY.videos, []),
    getJson<string[]>(c.env.TELEIOS_KV!, 'teleios:deleted_ids', []),
  ]);

  const studies = Array.isArray(studiesRaw) ? studiesRaw : [];
  const files = Array.isArray(filesRaw) ? filesRaw : [];
  const videos = Array.isArray(videosRaw) ? videosRaw : [];
  const deletedSet = new Set(Array.isArray(deletedIdsRaw) ? deletedIdsRaw : []);

  const toDeleteIds = new Set<string>();
  if (studyId) toDeleteIds.add(studyId);
  const studyToDelete = studies.find((s) => s.id === studyId);

  if (studyToDelete) {
    if (studyToDelete.fileId) toDeleteIds.add(studyToDelete.fileId);
    if (studyToDelete.documentName) {
      files.filter((f) => f.originalName === studyToDelete.documentName).forEach((f) => toDeleteIds.add(f.id));
    }
  }

  // Identificar qualquer arquivo ou vídeo que tenha ID igual ou referencie o studyId
  files.filter((f) => f.id === studyId).forEach((f) => toDeleteIds.add(f.id));
  videos.filter((v) => v.id === studyId || v.fileId === studyId).forEach((v) => {
    toDeleteIds.add(v.id);
    if (v.fileId) toDeleteIds.add(v.fileId);
  });

  // Excluir binários do R2 para todos os arquivos afetados
  const filesToDelete = files.filter((f) => toDeleteIds.has(f.id));
  for (const f of filesToDelete) {
    if (f.r2Key) {
      try {
        await c.env.TELEIOS_MEDIA.delete(f.r2Key);
        await c.env.TELEIOS_MEDIA.delete(`${f.r2Key}.thumb.webp`);
      } catch (e) {
        console.error('[Worker] Erro ao deletar objeto R2:', e);
      }
    }
    if (f.thumbnailKey) {
      try {
        await c.env.TELEIOS_MEDIA.delete(f.thumbnailKey);
      } catch {}
    }
  }

  // Filtrar KV collections
  const updatedStudies = studies.filter((s) => !toDeleteIds.has(s.id) && (!s.fileId || !toDeleteIds.has(s.fileId)));
  const updatedFiles = files.filter((f) => !toDeleteIds.has(f.id));
  const updatedVideos = videos.filter((v) => !toDeleteIds.has(v.id) && (!v.fileId || !toDeleteIds.has(v.fileId)));

  toDeleteIds.forEach((id) => deletedSet.add(id));
  const updatedDeletedIds = Array.from(deletedSet).slice(-1000);

  await Promise.all([
    putJson(c.env.TELEIOS_KV!, KEY.studies, updatedStudies),
    putJson(c.env.TELEIOS_KV!, KEY.files, updatedFiles),
    putJson(c.env.TELEIOS_KV!, KEY.videos, updatedVideos),
    putJson(c.env.TELEIOS_KV!, 'teleios:deleted_ids', updatedDeletedIds),
  ]);

  return c.json({ success: true, message: 'Conteúdo excluído com sucesso permanentemente.' });
});

// ─── Galeria, Vídeos e Projetos ───────────────────────────────────────────────

app.get('/api/galeria', async (c) => {
  await bootstrap(c.env);
  const files = await getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []);
  // Retorna todas as fotos/imagens sem filtros restritivos para garantir visibilidade total
  const data = files.filter((f) =>
    !f.category ||
    f.category === 'GALERIA' ||
    f.category === 'IMAGEM' ||
    f.mimeType?.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp|svg|bmp|avif)$/i.test(f.originalName || '')
  );
  return c.json({ success: true, count: data.length, data });
});

app.get('/api/videos', async (c) => {
  await bootstrap(c.env);
  const [videos, files] = await Promise.all([
    getJson<Video[]>(c.env.TELEIOS_KV!, KEY.videos, []),
    getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []),
  ]);
  return c.json({
    success: true,
    count: videos.length,
    data: videos.map((v) => ({ ...v, mediaFile: files.find((f) => f.id === v.fileId) })),
  });
});

app.put('/api/videos/:id', authMiddleware, requirePermission('videos'), async (c) => {
  await bootstrap(c.env);
  const idParam = c.req.param('id');
  const body = await c.req.json<any>();

  const videos = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.videos, []);
  const index = videos.findIndex((v) => v.id === idParam);
  if (index === -1) {
    return c.json({ success: false, error: 'Vídeo não encontrado.' }, 404);
  }

  const updatedVideo = {
    ...videos[index],
    title: body.title !== undefined ? body.title : videos[index].title,
    description: body.description !== undefined ? body.description : (body.content !== undefined ? body.content : videos[index].description),
    youtubeUrl: body.youtubeUrl !== undefined ? body.youtubeUrl : (body.videoUrl !== undefined ? body.videoUrl : videos[index].youtubeUrl),
    published: body.published !== undefined ? body.published : videos[index].published,
    status: body.status !== undefined ? body.status : videos[index].status,
    scheduledAt: body.scheduledAt !== undefined ? body.scheduledAt : videos[index].scheduledAt,
    updatedAt: now(),
  };

  videos[index] = updatedVideo;
  await putJson(c.env.TELEIOS_KV!, KEY.videos, videos);

  return c.json({ success: true, data: updatedVideo, message: 'Vídeo atualizado com sucesso.' });
});

app.delete('/api/videos/:id', authMiddleware, requirePermission('videos'), async (c) => {
  await bootstrap(c.env);
  const idParam = c.req.param('id');

  const videos = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.videos, []);
  const filtered = videos.filter((v) => v.id !== idParam);
  if (filtered.length === videos.length) {
    return c.json({ success: false, error: 'Vídeo não encontrado.' }, 404);
  }

  await putJson(c.env.TELEIOS_KV!, KEY.videos, filtered);
  return c.json({ success: true, message: 'Vídeo excluído com sucesso.' });
});

app.get('/api/projetos', async (c) => {
  await bootstrap(c.env);
  const files = await getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []);
  const data = files.filter((f) => f.category === 'PROJETO' || f.category === 'APOIO');
  return c.json({ success: true, count: data.length, data });
});

app.get('/api/status', async (c) => {
  await bootstrap(c.env);
  const [files, studies, videos] = await Promise.all([
    getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []),
    getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []),
    getJson<Video[]>(c.env.TELEIOS_KV!, KEY.videos, []),
  ]);
  const config = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
  const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);

  return c.json({
    success: true,
    data: {
      gemini: {
        configured: Boolean(config.gemini?.apiKey || config.gemini?.configured),
        model: config.gemini?.model || 'gemini-1.5-flash',
        status: config.gemini?.status || (config.gemini?.apiKey ? 'online' : 'offline'),
      },
      drive: {
        configured: Boolean(config.googleDrive?.serviceAccountEmail || config.googleDrive?.configured),
        rootFolder: config.googleDrive?.rootFolderName || 'Teleios_Backup',
        status: config.googleDrive?.status || (config.googleDrive?.serviceAccountEmail ? 'online' : 'ready'),
      },
      whastmeo: { configured: false, vpsUrl: '', status: 'standby' },
      youtube: { configured: false, status: 'standby' },
      scheduler: { nextRuns: [], active: false, cronSchedule: '' },
      stats: {
        totalFiles: files.length,
        totalStudies: studies.length,
        whatsappDispatched: studies.filter((s) => s.sentToWhatsapp).length,
        youtubeVideos: videos.length,
        totalLeads: leads.length,
        prayerRequests: leads.filter((l) => l.type === 'pedido_oracao').length,
        donations: leads.filter((l) => l.type === 'doacao').length,
      },
    },
  });
});

app.post('/api/upload', authMiddleware, requirePermission('ingest'), async (c) => {
  await bootstrap(c.env);
  const form = await c.req.formData();
  const category = String(form.get('category') || 'ESTUDO');
  const textContent = String(form.get('textContent') || '');
  const value = form.get('file');
  const file = typeof value === 'string' || !value ? null : (value as unknown as File);
  const fileArrayBuffer = file ? await file.arrayBuffer() : null;
  const fileId = id('file');
  const fileName = file?.name || String(form.get('fileName') || 'novo_texto.txt');
  const mimeType = file?.type || String(form.get('mimeType') || 'text/plain');
  const r2Key = file ? `${fileId}/${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}` : null;
  if (file && r2Key && fileArrayBuffer) await c.env.TELEIOS_MEDIA.put(r2Key, fileArrayBuffer, { httpMetadata: { contentType: mimeType } });

  // Processamento e salvamento de Thumbnail opcional (gerado pelo cliente)
  const thumbValue = form.get('thumbnail') || form.get('thumbFile');
  const thumbFile = typeof thumbValue === 'string' || !thumbValue ? null : (thumbValue as unknown as File);
  let thumbnailKey: string | null = null;
  if (thumbFile) {
    try {
      const thumbBuffer = await thumbFile.arrayBuffer();
      const sanitizedBase = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
      thumbnailKey = `${fileId}/thumb_${sanitizedBase}.webp`;
      await c.env.TELEIOS_MEDIA.put(thumbnailKey, thumbBuffer, {
        httpMetadata: { contentType: thumbFile.type || 'image/webp' },
      });
    } catch (tErr) {
      console.warn('[Thumbnail Upload Warning]', tErr);
    }
  }

  const currentConfig = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
  const drive = currentConfig.googleDrive;
  let driveFileId: string | null = null;
  let driveWebViewLink: string | null = null;
  let driveFolderPath: string = 'R2/teleios-media';

  if (drive?.serviceAccountEmail && drive?.privateKey) {
    try {
      const contentBuffer = fileArrayBuffer || textContent;
      const driveUpload = await uploadFileToGoogleDrive(
        {
          serviceAccountEmail: drive.serviceAccountEmail,
          privateKey: drive.privateKey,
          rootFolderId: drive.rootFolderId,
        },
        {
          fileName,
          mimeType,
          content: contentBuffer,
        }
      );
      driveFileId = driveUpload.driveFileId;
      driveWebViewLink = driveUpload.webViewLink;
      driveFolderPath = drive.rootFolderName || 'GoogleDrive';
    } catch (dErr) {
      console.warn('[Google Drive Auto-Upload Warning]', dErr);
    }
  }

  const mediaFile: MediaFile = {
    id: fileId,
    originalName: fileName,
    mimeType,
    size: file?.size || textContent.length,
    category,
    driveFileId: driveFileId || r2Key,
    driveWebViewLink: driveWebViewLink || (r2Key ? new URL(`/api/media/${fileId}`, c.req.url).toString() : null),
    thumbnailKey,
    thumbnailUrl: thumbnailKey ? new URL(`/api/media/${fileId}?variant=thumbnail`, c.req.url).toString() : null,
    driveFolderPath,
    status: category === 'ESTUDO' ? 'PENDING' : 'COMPLETED',
    createdAt: now(),
    r2Key,
  };
  const files = await getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []);
  files.unshift(mediaFile);
  await putJson(c.env.TELEIOS_KV!, KEY.files, files);

  // Enfileirar na fila de backup incremental assíncrono
  enqueueBackup(c.env.TELEIOS_KV!, {
    id: fileId,
    type: 'FILE',
    fileName,
    category,
    r2Key,
    createdAt: now(),
  }).catch(() => {});
  if (category === 'ESTUDO') {
    const studies = await getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []);
    const study = {
      id: id('study'),
      fileId,
      title: String(form.get('fileName') || fileName.replace(/\.[^.]+$/, '')),
      type: 'Estudo',
      status: 'PUBLICADO',
      published: true,
      rawContent: textContent || (file ? await file.text() : ''),
      content: textContent || (file ? await file.text() : ''),
      summary: null,
      aiImagePrompt: null,
      generatedImgUrl: null,
      scheduledAt: null,
      sentToWhatsapp: false,
      sentAt: null,
      createdAt: now(),
    };
    studies.unshift(study);
    await putJson(c.env.TELEIOS_KV!, KEY.studies, studies);
    return c.json({ success: true, mediaFile, study, message: 'Estudo publicado com sucesso.' }, 201);
  }
  if (category === 'VIDEO') {
    const videos = await getJson<Video[]>(c.env.TELEIOS_KV!, KEY.videos, []);
    const video = {
      id: id('video'),
      fileId,
      title: String(form.get('videoTitle') || fileName.replace(/\.[^.]+$/, '')),
      description: String(form.get('videoDescription') || ''),
      scheduledAt: null,
      published: false,
      youtubeUrl: null,
    };
    videos.unshift(video);
    await putJson(c.env.TELEIOS_KV!, KEY.videos, videos);
    return c.json({ success: true, mediaFile, videoMetadata: video }, 201);
  }
  return c.json({ success: true, mediaFile, message: 'Arquivo publicado com sucesso.' }, 201);
});

app.get('/api/media/:id', async (c) => {
  const files = await getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []);
  const fileId = c.req.param('id');
  const file = files.find((item) => item.id === fileId);
  if (!file?.r2Key) return c.json({ success: false, error: 'Arquivo não encontrado.' }, 404);

  const variant = c.req.query('variant');
  let targetKey = file.r2Key;
  if (variant === 'thumbnail' && file.thumbnailKey) {
    targetKey = file.thumbnailKey;
  } else if (variant === 'optimized' && file.optimizedKey) {
    targetKey = file.optimizedKey;
  }

  // Suporte a Range Request (HTTP 206) para streaming de vídeo e áudio
  const rangeHeader = c.req.header('Range');
  let object: any = null;

  try {
    if (rangeHeader) {
      object = await c.env.TELEIOS_MEDIA.get(targetKey, {
        range: c.req.raw.headers,
        onlyIf: c.req.raw.headers,
      });
    } else {
      object = await c.env.TELEIOS_MEDIA.get(targetKey);
    }
  } catch {
    object = await c.env.TELEIOS_MEDIA.get(targetKey);
  }

  if (!object) return c.json({ success: false, error: 'Objeto não encontrado no storage.' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Disposition', `inline; filename="${file.originalName}"`);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  if (object.range && 'offset' in object.range) {
    const range = object.range as any;
    headers.set(
      'Content-Range',
      `bytes ${range.offset}-${range.offset + (range.length || 0) - 1}/${object.size}`
    );
    return new Response(object.body, {
      status: 206,
      headers,
    });
  }

  return new Response(object.body, {
    status: 200,
    headers,
  });
});

// ─── Backup Seguro para Google Drive / R2 ─────────────────────────────────────

app.post('/api/backup', authMiddleware, requirePermission('config'), async (c) => {
  await bootstrap(c.env);
  const queue = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.backupQueue, []);
  const prevStatus = await getJson<any>(c.env.TELEIOS_KV!, KEY.backup, { syncedCount: 0 });

  // Processar em pequenos lotes (máximo 10 itens por vez para não sobrecarregar)
  const batch = queue.splice(0, 10);
  const timestamp = now();

  const [studies, files, channels, videos] = await Promise.all([
    getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []),
    getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []),
    getJson<Channel[]>(c.env.TELEIOS_KV!, KEY.channels, []),
    getJson<Video[]>(c.env.TELEIOS_KV!, KEY.videos, []),
  ]);

  // Salvar cada item incremental na pasta organizada do Google Drive / R2
  for (const item of batch) {
    try {
      if (item.type === 'CONTENT') {
        const study = studies.find((s) => s.id === item.id);
        if (study) {
          const folder = (study.type || 'Devocionais').replace(/[^a-zA-Z0-9_-]/g, '_');
          const r2Path = `Teleios_Backup/Conteudos/${folder}/${study.id}.json`;
          await c.env.TELEIOS_MEDIA.put(r2Path, JSON.stringify(study, null, 2), {
            httpMetadata: { contentType: 'application/json' },
          });
        }
      } else if (item.type === 'FILE') {
        const file = files.find((f) => f.id === item.id);
        if (file) {
          const folder = (file.category || 'Outros').replace(/[^a-zA-Z0-9_-]/g, '_');
          const r2Path = `Teleios_Backup/Midias/${folder}/${file.id}.json`;
          await c.env.TELEIOS_MEDIA.put(r2Path, JSON.stringify(file, null, 2), {
            httpMetadata: { contentType: 'application/json' },
          });
        }
      }
    } catch (err) {
      console.error('[Backup Incremental Item Error]', err);
    }
  }

  // Snapshot consolidado da base em Database/snapshots/
  const dateStr = timestamp.slice(0, 10);
  const snapshotKey = `Teleios_Backup/Database/snapshots/snapshot-${dateStr}.json`;
  const snapshotLatestKey = `Teleios_Backup/Database/snapshots/snapshot-latest.json`;
  const snapshotData = {
    version: '1.0.0',
    createdAt: timestamp,
    counts: {
      studies: studies.length,
      files: files.length,
      channels: channels.length,
      videos: videos.length,
    },
    data: {
      studies,
      files,
      channels,
      videos,
    },
  };
  const snapshotJson = JSON.stringify(snapshotData, null, 2);

  try {
    await Promise.all([
      c.env.TELEIOS_MEDIA.put(snapshotKey, snapshotJson, {
        httpMetadata: { contentType: 'application/json' },
      }),
      c.env.TELEIOS_MEDIA.put(snapshotLatestKey, snapshotJson, {
        httpMetadata: { contentType: 'application/json' },
      }),
    ]);
  } catch (e) {
    console.error('[Backup Snapshot Error]', e);
  }

  // Atualizar a fila no KV
  await putJson(c.env.TELEIOS_KV!, KEY.backupQueue, queue);

  const backupStatus = {
    lastBackupAt: timestamp,
    lastBackupKey: snapshotLatestKey,
    pendingCount: queue.length,
    syncedCount: (prevStatus.syncedCount || 0) + batch.length,
    lastBatchProcessed: batch.length,
    totalItems: studies.length + files.length + channels.length + videos.length,
    lastError: null,
    success: true,
  };

  await putJson(c.env.TELEIOS_KV!, KEY.backup, backupStatus);

  return c.json({
    success: true,
    message: batch.length > 0
      ? `Lote incremental de backup processado com sucesso (${batch.length} itens sincronizados).`
      : 'Backup estruturado sincronizado com sucesso.',
    data: backupStatus,
  });
});

app.get('/api/backup/status', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const [status, queue] = await Promise.all([
    getJson<any>(c.env.TELEIOS_KV!, KEY.backup, {
      lastBackupAt: null,
      syncedCount: 0,
      pendingCount: 0,
      lastError: null,
      success: true,
    }),
    getJson<any[]>(c.env.TELEIOS_KV!, KEY.backupQueue, []),
  ]);
  return c.json({
    success: true,
    data: {
      ...status,
      pendingCount: queue.length,
    },
  });
});

app.get('/api/backup/download', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const [studies, files, channels, videos] = await Promise.all([
    getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []),
    getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []),
    getJson<Channel[]>(c.env.TELEIOS_KV!, KEY.channels, []),
    getJson<Video[]>(c.env.TELEIOS_KV!, KEY.videos, []),
  ]);

  const backupData = {
    platform: 'Teleios Platform',
    version: '1.0.0',
    createdAt: now(),
    counts: {
      studies: studies.length,
      files: files.length,
      channels: channels.length,
      videos: videos.length,
    },
    data: {
      studies,
      files,
      channels,
      videos,
    },
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  return new Response(jsonStr, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="teleios-backup-${now().split('T')[0]}.json"`,
      'Access-Control-Allow-Origin': c.req.header('Origin') || '*',
    },
  });
});

// ─── Agent WebSocket & DO Coordinator ─────────────────────────────────────────

app.get('/api/agent/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.json({ success: false, error: 'Expected WebSocket upgrade.' }, 426);
  }

  const mode = c.req.query('mode') || 'agent';

  if (mode === 'agent') {
    const agentSecret = c.req.header('X-Agent-Secret');
    const expectedSecret = c.env.AGENT_SECRET || '3M7#kL2$vP9!xR4z';
    if (!agentSecret || agentSecret !== expectedSecret) {
      return c.json({ success: false, error: 'Agent secret inválido.' }, 401);
    }
  } else if (mode === 'admin') {
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

    const user = await validateWorkerToken(token, c.env.JWT_SECRET || 'change-me');
    if (!user) return c.json({ success: false, error: 'Token inválido ou expirado.' }, 401);
  } else {
    return c.json({ success: false, error: 'Modo de WebSocket inválido.' }, 400);
  }

  const stub = getCoordinatorStub(c.env);
  const url = new URL(c.req.url);
  url.searchParams.set('mode', mode);
  return stub.fetch(new Request(url.toString(), c.req.raw));
});

app.get('/api/agent/groups', authMiddleware, async (c) => {
  try {
    const stub = getCoordinatorStub(c.env);
    const url = new URL(c.req.url);
    url.pathname = '/groups';
    const res = await stub.fetch(new Request(url.toString()));
    if (res.ok) {
      const data = await res.json();
      return c.json(data);
    }
  } catch (e) {
    console.warn('[Worker] Failed to fetch groups from DO:', e);
  }
  const channels = await getJson<Channel[]>(c.env.TELEIOS_KV!, KEY.channels, []);
  return c.json({ success: true, data: channels });
});

app.get('/api/agent/status', authMiddleware, async (c) => {
  try {
    const stub = getCoordinatorStub(c.env);
    const url = new URL(c.req.url);
    url.pathname = '/status';
    const res = await stub.fetch(new Request(url.toString()));
    if (res.ok) {
      const data = await res.json();
      return c.json(data);
    }
  } catch (e) {
    console.warn('[Worker] Failed to fetch status from DO:', e);
  }
  return c.json({
    agentId: 'agent_local_001',
    agentStatus: 'ONLINE',
    whatsappStatus: 'CONNECTED',
    sessionStatus: 'VALID',
  });
});

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
    studyId?: string;
    channelId?: string;
    targetPhone?: string;
    scheduledAt?: string;
    content?: string;
    mediaUrl?: string;
  }>();

  const [studies, channels] = await Promise.all([
    getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []),
    getJson<Channel[]>(c.env.TELEIOS_KV!, KEY.channels, []),
  ]);

  let study = body.studyId ? studies.find((s) => s.id === body.studyId) : null;
  if (!study) {
    study = {
      id: body.studyId || id('study_direct'),
      title: 'Mensagem WhatsApp',
      type: 'Devocional',
      status: 'PUBLICADO',
      published: true,
      content: body.content || '',
      rawContent: body.content || '',
      createdAt: now(),
      updatedAt: now(),
    };
  }

  let channelId = body.channelId || study.channelId;
  let targetPhone = body.targetPhone || study.targetPhone;

  // Fallback: se não foi informado canal nem telefone, tentar o canal global configurado antes de fallback genérico
  if (!channelId && !targetPhone) {
    const config = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
    const globalChannelJid = config.whatsapp?.defaultChannelJid;
    if (globalChannelJid) {
      channelId = globalChannelJid;
    } else if (channels.length > 0) {
      const activeCh: any = channels.find((ch: any) => ch.isGlobal || ch.active) || channels[0];
      channelId = activeCh.jid || activeCh.whatsappJid || activeCh.id;
    }
  }

  let recipientJid = '';
  let agentId = 'agent_local_001';

  if (channelId) {
    if (channelId.includes('@')) {
      // Já é um JID completo (ex: 120363427119280381@newsletter, 120363430361841304@g.us, 5511...@s.whatsapp.net)
      recipientJid = channelId;
    } else {
      // Procurar nos canais cadastrados
      const channel: any = channels.find((ch: any) =>
        ch.id === channelId ||
        ch.jid === channelId ||
        ch.whatsappJid === channelId ||
        (ch.jid && ch.jid.includes(channelId))
      );
      if (channel) {
        recipientJid = channel.jid || channel.whatsappJid || (channel.id && channel.id.includes('@') ? channel.id : `${channel.id}@g.us`);
        agentId = channel.agentId || 'agent_local_001';
      } else if (channelId === 'direct_default') {
        recipientJid = '5511999998888@s.whatsapp.net';
      } else {
        const clean = channelId.replace(/\D/g, '');
        if (clean.length > 15) {
          recipientJid = `${clean}@g.us`;
        } else if (clean.length >= 10) {
          recipientJid = `${clean}@s.whatsapp.net`;
        } else {
          recipientJid = `${channelId}@g.us`;
        }
      }
    }
  } else if (targetPhone) {
    const cleanPhone = targetPhone.replace(/\D/g, '');
    recipientJid = cleanPhone ? `${cleanPhone}@s.whatsapp.net` : targetPhone;
  } else {
    return c.json({ success: false, error: 'Selecione um canal, grupo ou telefone de destino.' }, 400);
  }

  if (!recipientJid || recipientJid.includes('direct_default')) {
    return c.json({ success: false, error: 'Selecione um canal, grupo ou telefone de destino válido.' }, 400);
  }

  const content = body.content || study.summary || study.rawContent || study.title || '';
  const isScheduled = Boolean(body.scheduledAt && new Date(body.scheduledAt).getTime() > Date.now());
  const mediaUrl =
    body.mediaUrl ||
    study.generatedImgUrl ||
    study.aiImageUrl ||
    (study.mediaFile?.driveWebViewLink) ||
    undefined;

  const job: Job = {
    id: id('job'),
    studyId: body.studyId || study.id || '',
    channelId: channelId || 'direct_message',
    agentId: agentId,
    recipientJid,
    content,
    mediaUrl,
    scheduledAt: isScheduled ? new Date(body.scheduledAt!).toISOString() : null,
    status: isScheduled ? 'PENDING' : 'READY',
    attempts: 0,
    createdAt: now(),
    updatedAt: now(),
  };

  const jobs = await getJson<Job[]>(c.env.TELEIOS_KV!, KEY.jobs, []);
  jobs.unshift(job);
  await Promise.all([
    putJson(c.env.TELEIOS_KV!, KEY.jobs, jobs),
    putJson(c.env.TELEIOS_KV!, `${KEY.jobs}:${job.id}`, job),
  ]);

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
  }

  return c.json({ success: true, data: job }, 201);
});

app.delete('/api/jobs/:id', authMiddleware, requirePermission('estudos'), async (c) => {
  await bootstrap(c.env);
  const jobs = await getJson<Job[]>(c.env.TELEIOS_KV!, KEY.jobs, []);
  const job = jobs.find((j) => j.id === c.req.param('id'));
  if (!job) return c.json({ success: false, error: 'Job não encontrado.' }, 404);
  if (job.status === 'SENT') return c.json({ success: false, error: 'Não é possível cancelar job já enviado.' }, 400);
  const updated = jobs.map((j) => (j.id === c.req.param('id') ? { ...j, status: 'CANCELLED' as const, updatedAt: now() } : j));
  await putJson(c.env.TELEIOS_KV!, KEY.jobs, updated);
  return c.json({ success: true });
});

// ─── LEADS & PEDIDOS DE ORAÇÃO ───────────────────────────────────────────────

app.post('/api/leads/oracao', async (c) => {
  await bootstrap(c.env);
  const body: any = await c.req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim().replace(/[^0-9+() -]/g, '');

  if (!name || name.length < 2) {
    return c.json({ success: false, error: 'Por favor, informe seu nome completo.' }, 400);
  }
  if (!phone || phone.replace(/\D/g, '').length < 8) {
    return c.json({ success: false, error: 'Por favor, informe um número de telefone/WhatsApp válido com DDD.' }, 400);
  }

  const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);
  const newLead = {
    id: id('lead'),
    name,
    phone,
    type: 'pedido_oracao',
    status: 'PENDENTE',
    receiptProvided: false,
    createdAt: now(),
    updatedAt: now(),
  };

  leads.unshift(newLead);
  await putJson(c.env.TELEIOS_KV!, KEY.leads, leads);

  // Enfileirar na fila de backup incremental assíncrono
  enqueueBackup(c.env.TELEIOS_KV!, {
    id: newLead.id,
    type: 'LEAD',
    leadType: 'pedido_oracao',
    name: newLead.name,
    createdAt: newLead.createdAt,
  }).catch(() => {});

  return c.json({
    success: true,
    message: 'Pedido de oração recebido com sucesso! Estaremos orando por você.',
    data: newLead,
  }, 201);
});

// ─── DOAÇÕES & COMPROVANTES PIX ──────────────────────────────────────────────

app.post('/api/leads/doacao', async (c) => {
  await bootstrap(c.env);
  let name = '';
  let phone = '';
  let amount = 0;
  let receiptProvided = false;
  let receiptFileId: string | null = null;
  let receiptUrl: string | null = null;

  const contentType = c.req.header('Content-Type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await c.req.formData();
    name = String(form.get('name') || '').trim();
    phone = String(form.get('phone') || '').trim().replace(/[^0-9+() -]/g, '');
    amount = parseFloat(String(form.get('amount') || '0'));
    const value = form.get('receipt');
    const file = typeof value === 'string' || !value ? null : (value as unknown as File);

    if (file && file.size > 0) {
      receiptProvided = true;
      receiptFileId = id('receipt');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const r2Key = `receipts/${receiptFileId}/${safeName}`;
      await c.env.TELEIOS_MEDIA.put(r2Key, file.stream(), {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
        customMetadata: { originalName: file.name, leadName: name },
      });
      receiptUrl = `/api/media/${receiptFileId}`;

      // Salvar registro de arquivo na tabela de arquivos
      const files = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.files, []);
      files.unshift({
        id: receiptFileId,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        category: 'APOIO',
        r2Key,
        driveWebViewLink: new URL(`/api/media/${receiptFileId}`, c.req.url).toString(),
        status: 'COMPLETED',
        createdAt: now(),
      });
      await putJson(c.env.TELEIOS_KV!, KEY.files, files);
    }
  } else {
    const body = await c.req.json<any>().catch(() => ({}));
    name = String(body?.name || '').trim();
    phone = String(body?.phone || '').trim().replace(/[^0-9+() -]/g, '');
    amount = parseFloat(String(body?.amount || '0'));
  }

  if (!name || name.length < 2) {
    name = 'Doador';
  }
  if (!phone || phone.replace(/\D/g, '').length < 8) {
    return c.json({ success: false, error: 'Por favor, informe um número de telefone com DDD.' }, 400);
  }
  if (isNaN(amount) || amount <= 0) {
    return c.json({ success: false, error: 'Por favor, informe um valor de doação válido.' }, 400);
  }

  const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);
  const newLead = {
    id: id('lead'),
    name,
    phone,
    type: 'doacao',
    status: 'PENDENTE',
    amount,
    receiptProvided,
    receiptFileId,
    receiptUrl,
    createdAt: now(),
    updatedAt: now(),
  };

  leads.unshift(newLead);
  await putJson(c.env.TELEIOS_KV!, KEY.leads, leads);

  // Enfileirar na fila de backup incremental assíncrono
  enqueueBackup(c.env.TELEIOS_KV!, {
    id: newLead.id,
    type: 'LEAD',
    leadType: 'doacao',
    amount: newLead.amount,
    receiptProvided: newLead.receiptProvided,
    name: newLead.name,
    createdAt: newLead.createdAt,
  }).catch(() => {});

  return c.json({
    success: true,
    message: 'Doação registrada com sucesso! Muito obrigado pelo apoio e generosidade.',
    data: newLead,
  }, 201);
});

// ─── ADMIN: LEADS / INSCRIÇÕES ────────────────────────────────────────────────

app.get('/api/leads', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const type = c.req.query('type');
  const status = c.req.query('status');
  const search = (c.req.query('search') || '').toLowerCase().trim();

  let leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);

  if (type && type !== 'TODOS') {
    leads = leads.filter((l) => l.type === type);
  }
  if (status && status !== 'TODOS') {
    leads = leads.filter((l) => l.status === status);
  }
  if (search) {
    leads = leads.filter(
      (l) => (l.name || '').toLowerCase().includes(search) || (l.phone || '').includes(search)
    );
  }

  return c.json({ success: true, count: leads.length, data: leads });
});

app.patch('/api/leads/:id', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const leadId = c.req.param('id');
  const body: any = await c.req.json().catch(() => ({}));

  const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);
  const idx = leads.findIndex((l) => l.id === leadId);
  if (idx === -1) {
    return c.json({ success: false, error: 'Inscrição não encontrada.' }, 404);
  }

  leads[idx] = {
    ...leads[idx],
    status: body.status || leads[idx].status,
    notes: body.notes !== undefined ? body.notes : leads[idx].notes,
    updatedAt: now(),
  };

  await putJson(c.env.TELEIOS_KV!, KEY.leads, leads);
  return c.json({ success: true, data: leads[idx], message: 'Inscrição atualizada com sucesso.' });
});

app.delete('/api/leads/:id', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const leadId = c.req.param('id');
  const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);
  const lead = leads.find((l) => l.id === leadId);
  if (!lead) {
    return c.json({ success: false, error: 'Inscrição não encontrada.' }, 404);
  }

  if (lead.receiptFileId) {
    const files = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.files, []);
    const f = files.find((file) => file.id === lead.receiptFileId);
    if (f?.r2Key) {
      try {
        await c.env.TELEIOS_MEDIA.delete(f.r2Key);
      } catch (err) {
        console.error('[Worker] Erro ao deletar comprovante R2:', err);
      }
    }
    await putJson(c.env.TELEIOS_KV!, KEY.files, files.filter((file) => file.id !== lead.receiptFileId));
  }

  const updatedLeads = leads.filter((l) => l.id !== leadId);
  await putJson(c.env.TELEIOS_KV!, KEY.leads, updatedLeads);

  return c.json({ success: true, message: 'Inscrição excluída com sucesso.' });
});

// ─── USUÁRIOS DO APP (CADASTRO, LOGIN & PERFIL) ──────────────────────────────

// Registro de novo usuário do App com Nome, Username, Email, Senha e Telefone
app.post('/api/app/register', async (c) => {
  await bootstrap(c.env);
  const body: any = await c.req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const rawUsername = String(body.username || '').trim().replace(/^@/, '').toLowerCase();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const password = String(body.password || '').trim();
  const church = String(body.church || '').trim();

  if (!name || name.length < 2) {
    return c.json({ success: false, error: 'Nome completo obrigatório (mínimo 2 letras).' }, 400);
  }

  // Username: apenas letras, números, ponto e underline
  const username = rawUsername.replace(/[^a-z0-9_.]/g, '');
  if (!username || username.length < 3) {
    return c.json({ success: false, error: 'Nome de usuário inválido (mínimo 3 caracteres alfanuméricos).' }, 400);
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ success: false, error: 'E-mail em formato inválido.' }, 400);
  }

  if (!password || password.length < 6) {
    return c.json({ success: false, error: 'A senha deve ter no mínimo 6 caracteres.' }, 400);
  }

  const users = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.appUsers, []);

  // Verificar duplicidade de username
  const existingUsername = users.find((u) => (u.username || '').toLowerCase() === username);
  if (existingUsername) {
    return c.json({ success: false, error: 'Este nome de usuário já está em uso.' }, 409);
  }

  // Verificar duplicidade de email
  if (email) {
    const existingEmail = users.find((u) => (u.email || '').toLowerCase() === email);
    if (existingEmail) {
      return c.json({ success: false, error: 'Este e-mail já está cadastrado.' }, 409);
    }
  }

  // Verificar duplicidade de telefone
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length >= 8) {
    const existingPhone = users.find((u) => (u.phone || '').replace(/\D/g, '') === cleanPhone);
    if (existingPhone) {
      return c.json({ success: false, error: 'Este telefone já está cadastrado. Faça login para continuar.' }, 409);
    }
  }

  const passwordHash = await sha256(password);
  const newUserId = id('user');

  const userData = {
    id: newUserId,
    name,
    username,
    email: email || null,
    passwordHash,
    phone: phone || '',
    church: church || '',
    birthDate: body.birthDate || null,
    gender: body.gender || null,
    maritalStatus: body.maritalStatus || null,
    ministry: body.ministry || null,
    city: String(body.city || '').trim(),
    state: String(body.state || '').trim(),
    photoUrl: body.photoUrl || null,
    status: 'Ativo',
    isBaptized: Boolean(body.isBaptized),
    timeAsBeliever: String(body.timeAsBeliever || ''),
    inDiscipleship: Boolean(body.inDiscipleship),
    disciplerName: String(body.disciplerName || ''),
    notes: '',
    role: 'user',
    isAdmin: false,
    currentDevocional: null,
    currentEstudo: null,
    lastActivityAt: now(),
    createdAt: now(),
    updatedAt: now(),
  };

  users.unshift(userData);
  await putJson(c.env.TELEIOS_KV!, KEY.appUsers, users);

  const { passwordHash: _, ...safeProfile } = userData;
  return c.json({ success: true, user: safeProfile, data: safeProfile });
});

// Login do App: aceita E-mail, Nome de Usuário ou Telefone + Senha
app.post('/api/app/login', async (c) => {
  await bootstrap(c.env);
  const body: any = await c.req.json().catch(() => ({}));
  const identifier = String(body.identifier || body.username || body.email || body.phone || '').trim();
  const password = String(body.password || '').trim();

  if (!identifier) {
    return c.json({ success: false, error: 'Informe e-mail, nome de usuário ou telefone.' }, 400);
  }

  const users = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.appUsers, []);
  const cleanId = identifier.toLowerCase().replace(/^@/, '');
  const cleanDigits = identifier.replace(/\D/g, '');

  const user = users.find((u) => {
    const uName = (u.username || '').toLowerCase().replace(/^@/, '');
    const uEmail = (u.email || '').toLowerCase();
    const uPhone = (u.phone || '').replace(/\D/g, '');

    if (uName && uName === cleanId) return true;
    if (uEmail && uEmail === cleanId) return true;
    if (cleanDigits.length >= 8 && uPhone && uPhone === cleanDigits) return true;
    return false;
  });

  if (!user) {
    return c.json({ success: false, error: 'Usuário não encontrado.' }, 404);
  }

  if (user.status === 'Inativo') {
    return c.json({ success: false, error: 'Conta desativada. Entre em contato com a administração.' }, 403);
  }

  // Validação da senha
  if (user.passwordHash) {
    if (!password) {
      return c.json({ success: false, error: 'Senha obrigatória.' }, 400);
    }
    const hash = await sha256(password);
    if (hash !== user.passwordHash) {
      return c.json({ success: false, error: 'Senha incorreta.' }, 401);
    }
  } else if (password) {
    // Usuário pré-existente sem senha: salva senha no primeiro login com senha
    user.passwordHash = await sha256(password);
    user.updatedAt = now();
  }

  user.lastActivityAt = now();
  await putJson(c.env.TELEIOS_KV!, KEY.appUsers, users);

  const { passwordHash: _, ...safeProfile } = user;
  return c.json({
    success: true,
    user: {
      ...safeProfile,
      role: user.role || (user.isAdmin ? 'admin' : 'user'),
      isAdmin: Boolean(user.isAdmin || user.role === 'admin' || user.role === 'superadmin'),
    },
    data: {
      ...safeProfile,
      role: user.role || (user.isAdmin ? 'admin' : 'user'),
      isAdmin: Boolean(user.isAdmin || user.role === 'admin' || user.role === 'superadmin'),
    },
  });
});

// Atualizar ou criar perfil completo de usuário
app.post('/api/app/profile', async (c) => {
  await bootstrap(c.env);
  const body: any = await c.req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim().replace(/[^0-9+() -]/g, '');
  const username = body.username ? String(body.username).trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_.]/g, '') : undefined;
  const email = body.email ? String(body.email).trim().toLowerCase() : undefined;

  if (!name || name.length < 2) {
    return c.json({ success: false, error: 'Nome completo obrigatório.' }, 400);
  }

  const users = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.appUsers, []);
  const cleanPhone = phone.replace(/\D/g, '');
  const cleanUsername = username ? username.replace(/^@/, '').toLowerCase() : '';

  let userIdx = -1;
  if (body.id) {
    userIdx = users.findIndex((u) => u.id === body.id);
  }
  if (userIdx === -1 && cleanPhone) {
    userIdx = users.findIndex((u) => (u.phone || '').replace(/\D/g, '') === cleanPhone);
  }
  if (userIdx === -1 && cleanUsername) {
    userIdx = users.findIndex((u) => (u.username || '').toLowerCase() === cleanUsername);
  }

  // Hash de senha se o usuário enviou alteração de senha
  let passwordHash = userIdx >= 0 ? users[userIdx].passwordHash : undefined;
  if (body.password && String(body.password).trim().length >= 6) {
    passwordHash = await sha256(String(body.password).trim());
  }

  const userData = {
    id: userIdx >= 0 ? users[userIdx].id : id('user'),
    name,
    username: username !== undefined ? username : (userIdx >= 0 ? users[userIdx].username : null),
    email: email !== undefined ? email : (userIdx >= 0 ? users[userIdx].email : null),
    passwordHash,
    phone: phone || (userIdx >= 0 ? users[userIdx].phone : ''),
    church: String(body.church || (userIdx >= 0 ? users[userIdx].church : '')).trim(),
    birthDate: body.birthDate !== undefined ? body.birthDate : (userIdx >= 0 ? users[userIdx].birthDate : null),
    gender: body.gender !== undefined ? body.gender : (userIdx >= 0 ? users[userIdx].gender : null),
    maritalStatus: body.maritalStatus !== undefined ? body.maritalStatus : (userIdx >= 0 ? users[userIdx].maritalStatus : null),
    ministry: body.ministry !== undefined ? body.ministry : (userIdx >= 0 ? users[userIdx].ministry : null),
    city: String(body.city !== undefined ? body.city : (userIdx >= 0 ? users[userIdx].city : '')).trim(),
    state: String(body.state !== undefined ? body.state : (userIdx >= 0 ? users[userIdx].state : '')).trim(),
    photoUrl: body.photoUrl || (userIdx >= 0 ? users[userIdx].photoUrl : null),
    status: (userIdx >= 0 ? users[userIdx].status : 'Ativo') || 'Ativo',
    isBaptized: body.isBaptized !== undefined ? Boolean(body.isBaptized) : (userIdx >= 0 ? users[userIdx].isBaptized : false),
    timeAsBeliever: body.timeAsBeliever !== undefined ? String(body.timeAsBeliever) : (userIdx >= 0 ? users[userIdx].timeAsBeliever : ''),
    inDiscipleship: body.inDiscipleship !== undefined ? Boolean(body.inDiscipleship) : (userIdx >= 0 ? users[userIdx].inDiscipleship : false),
    disciplerName: body.disciplerName !== undefined ? String(body.disciplerName) : (userIdx >= 0 ? users[userIdx].disciplerName : ''),
    notes: body.notes !== undefined ? body.notes : (userIdx >= 0 ? users[userIdx].notes : ''),
    role: userIdx >= 0 ? (users[userIdx].role || 'user') : (body.role || 'user'),
    isAdmin: userIdx >= 0 ? Boolean(users[userIdx].isAdmin || users[userIdx].role === 'admin') : Boolean(body.isAdmin || body.role === 'admin'),
    currentDevocional: body.currentDevocional || (userIdx >= 0 ? users[userIdx].currentDevocional : null),
    currentEstudo: body.currentEstudo || (userIdx >= 0 ? users[userIdx].currentEstudo : null),
    lastActivityAt: now(),
    createdAt: userIdx >= 0 ? users[userIdx].createdAt : now(),
    updatedAt: now(),
  };

  if (userIdx >= 0) {
    users[userIdx] = { ...users[userIdx], ...userData };
  } else {
    users.unshift(userData);
  }

  await putJson(c.env.TELEIOS_KV!, KEY.appUsers, users);

  const { passwordHash: _, ...safeProfile } = userData;
  return c.json({ success: true, data: safeProfile });
});

// Buscar perfil de usuário por telefone, userId, username ou email
app.get('/api/app/profile', async (c) => {
  await bootstrap(c.env);
  const phone = c.req.query('phone');
  const userId = c.req.query('userId');
  const username = c.req.query('username');
  const email = c.req.query('email');

  if (!phone && !userId && !username && !email) {
    return c.json({ success: false, error: 'Informe telefone, userId, username ou email para busca.' }, 400);
  }

  const users = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.appUsers, []);
  let user: any = null;

  if (username) {
    const cleanU = username.trim().toLowerCase().replace(/^@/, '');
    user = users.find((u) => (u.username || '').toLowerCase().replace(/^@/, '') === cleanU);
  }

  if (!user && email) {
    const cleanE = email.trim().toLowerCase();
    user = users.find((u) => (u.email || '').toLowerCase() === cleanE);
  }

  if (!user && phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    user = users.find((u) => (u.phone || '').replace(/\D/g, '') === cleanPhone);

    // Fallback: buscar nos leads para usuários legados
    if (!user) {
      const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);
      const lead = leads.find((l) => (l.phone || '').replace(/\D/g, '') === cleanPhone);
      if (lead) {
        user = {
          id: `legacy_${lead.id}`,
          name: lead.name || 'Usuário',
          phone: lead.phone,
          church: '',
          status: 'Ativo',
          role: 'user',
          isAdmin: false,
          createdAt: lead.createdAt || now(),
          updatedAt: lead.updatedAt || now(),
        };
      }
    }
  } else if (!user && userId) {
    user = users.find((u) => u.id === userId);
  }

  if (!user) {
    return c.json({ success: false, error: 'Usuário não encontrado.' }, 404);
  }

  const { passwordHash: _, ...safeUser } = user;
  const enrichedUser = {
    ...safeUser,
    role: user.role || (user.isAdmin ? 'admin' : 'user'),
    isAdmin: Boolean(user.isAdmin || user.role === 'admin' || user.role === 'superadmin'),
  };

  return c.json({ success: true, data: enrichedUser });
});

// ADMIN: Listar usuários com resumo de atividade
app.get('/api/app/users', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const appUsers = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.appUsers, []);
  const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);

  // Mesclar leads que ainda não são appUsers formalizados
  const userPhones = new Set(appUsers.map((u) => (u.phone || '').replace(/\D/g, '')));

  leads.forEach((l) => {
    const cleanP = (l.phone || '').replace(/\D/g, '');
    if (cleanP && !userPhones.has(cleanP)) {
      appUsers.push({
        id: `legacy_${l.id}`,
        name: l.name || 'Usuário',
        phone: l.phone,
        church: '',
        status: 'Ativo',
        lastActivityAt: l.createdAt || now(),
        createdAt: l.createdAt || now(),
        updatedAt: l.updatedAt || now(),
      });
      userPhones.add(cleanP);
    }
  });

  // Enriquecer cada usuário com estatísticas
  const usersWithStats = appUsers.map((u) => {
    const cleanP = (u.phone || '').replace(/\D/g, '');
    const userPrayers = leads.filter((l) => l.type === 'pedido_oracao' && (l.phone || '').replace(/\D/g, '') === cleanP);
    const userDonations = leads.filter((l) => l.type === 'doacao' && (l.phone || '').replace(/\D/g, '') === cleanP);

    return {
      ...u,
      prayersCount: userPrayers.length,
      donationsCount: userDonations.length,
      donationsTotal: userDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
    };
  });

  return c.json({ success: true, count: usersWithStats.length, data: usersWithStats });
});

// ADMIN: Detalhe do usuário + orações + doações
app.get('/api/app/users/:id', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const userId = c.req.param('id');
  const appUsers = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.appUsers, []);
  const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);

  let user = appUsers.find((u) => u.id === userId);
  if (!user) {
    const lead = leads.find((l) => `legacy_${l.id}` === userId || l.id === userId);
    if (lead) {
      user = {
        id: `legacy_${lead.id}`,
        name: lead.name,
        phone: lead.phone,
        church: '',
        status: 'Ativo',
        lastActivityAt: lead.createdAt || now(),
        createdAt: lead.createdAt || now(),
      };
    }
  }

  if (!user) {
    return c.json({ success: false, error: 'Usuário não encontrado.' }, 404);
  }

  const cleanP = (user.phone || '').replace(/\D/g, '');
  const prayers = leads.filter((l) => l.type === 'pedido_oracao' && (l.phone || '').replace(/\D/g, '') === cleanP);
  const donations = leads.filter((l) => l.type === 'doacao' && (l.phone || '').replace(/\D/g, '') === cleanP);

  return c.json({
    success: true,
    data: {
      user,
      prayers,
      donations,
    },
  });
});

// ADMIN: Atualizar dados de usuário e discipulado
app.put('/api/app/users/:id', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const userId = c.req.param('id');
  const body: any = await c.req.json().catch(() => ({}));
  const appUsers = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.appUsers, []);

  let idx = appUsers.findIndex((u) => u.id === userId);
  if (idx === -1) {
    // Se veio de legacy lead, criar no appUsers
    const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);
    const lead = leads.find((l) => `legacy_${l.id}` === userId || l.id === userId);
    if (!lead) {
      return c.json({ success: false, error: 'Usuário não encontrado.' }, 404);
    }
    const newUser = {
      id: userId,
      name: body.name || lead.name,
      phone: body.phone || lead.phone,
      church: body.church || '',
      city: body.city || '',
      state: body.state || '',
      status: body.status || 'Ativo',
      role: body.role || (body.isAdmin ? 'admin' : 'user'),
      isAdmin: Boolean(body.isAdmin || body.role === 'admin'),
      isBaptized: Boolean(body.isBaptized),
      timeAsBeliever: body.timeAsBeliever || '',
      inDiscipleship: Boolean(body.inDiscipleship),
      disciplerName: body.disciplerName || '',
      notes: body.notes || '',
      createdAt: lead.createdAt || now(),
      updatedAt: now(),
      lastActivityAt: now(),
    };
    appUsers.unshift(newUser);
    idx = 0;
  } else {
    appUsers[idx] = {
      ...appUsers[idx],
      name: body.name !== undefined ? body.name : appUsers[idx].name,
      username: body.username !== undefined ? String(body.username).replace(/^@/, '').toLowerCase().trim() : appUsers[idx].username,
      email: body.email !== undefined ? String(body.email).toLowerCase().trim() : appUsers[idx].email,
      birthDate: body.birthDate !== undefined ? body.birthDate : appUsers[idx].birthDate,
      gender: body.gender !== undefined ? body.gender : appUsers[idx].gender,
      maritalStatus: body.maritalStatus !== undefined ? body.maritalStatus : appUsers[idx].maritalStatus,
      ministry: body.ministry !== undefined ? body.ministry : appUsers[idx].ministry,
      church: body.church !== undefined ? body.church : appUsers[idx].church,
      city: body.city !== undefined ? body.city : appUsers[idx].city,
      state: body.state !== undefined ? body.state : appUsers[idx].state,
      status: body.status !== undefined ? body.status : appUsers[idx].status,
      role: body.role !== undefined ? body.role : (body.isAdmin !== undefined ? (body.isAdmin ? 'admin' : 'user') : (appUsers[idx].role || 'user')),
      isAdmin: body.isAdmin !== undefined ? Boolean(body.isAdmin) : (body.role !== undefined ? (body.role === 'admin') : Boolean(appUsers[idx].isAdmin || appUsers[idx].role === 'admin')),
      isBaptized: body.isBaptized !== undefined ? Boolean(body.isBaptized) : appUsers[idx].isBaptized,
      timeAsBeliever: body.timeAsBeliever !== undefined ? body.timeAsBeliever : appUsers[idx].timeAsBeliever,
      inDiscipleship: body.inDiscipleship !== undefined ? Boolean(body.inDiscipleship) : appUsers[idx].inDiscipleship,
      disciplerName: body.disciplerName !== undefined ? body.disciplerName : appUsers[idx].disciplerName,
      notes: body.notes !== undefined ? body.notes : appUsers[idx].notes,
      updatedAt: now(),
    };
  }

  await putJson(c.env.TELEIOS_KV!, KEY.appUsers, appUsers);
  const { passwordHash: _, ...safeUpdated } = appUsers[idx];
  return c.json({ success: true, data: safeUpdated, message: 'Usuário atualizado com sucesso.' });
});

// ─── ORAÇÕES DO APP ─────────────────────────────────────────────────────────

app.post('/api/app/prayers', async (c) => {
  await bootstrap(c.env);
  const body: any = await c.req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim().replace(/[^0-9+() -]/g, '');
  const title = String(body.title || 'Pedido de Oração').trim();
  const content = String(body.content || '').trim();

  if (!content) {
    return c.json({ success: false, error: 'O pedido de oração é obrigatório.' }, 400);
  }
  if (!phone) {
    return c.json({ success: false, error: 'Telefone do usuário é obrigatório.' }, 400);
  }

  const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);
  const newPrayer = {
    id: id('oracao'),
    name: name || 'Membro Teleios',
    phone,
    title,
    content,
    type: 'pedido_oracao',
    status: 'PENDENTE',
    createdAt: body.date || now(),
    updatedAt: now(),
  };

  leads.unshift(newPrayer);
  await putJson(c.env.TELEIOS_KV!, KEY.leads, leads);

  // Atualiza última atividade do usuário
  const appUsers = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.appUsers, []);
  const cleanP = phone.replace(/\D/g, '');
  const uIdx = appUsers.findIndex((u) => (u.phone || '').replace(/\D/g, '') === cleanP);
  if (uIdx >= 0) {
    appUsers[uIdx].lastActivityAt = now();
    await putJson(c.env.TELEIOS_KV!, KEY.appUsers, appUsers);
  }

  return c.json({ success: true, data: newPrayer }, 201);
});

app.get('/api/app/prayers', async (c) => {
  await bootstrap(c.env);
  const phone = (c.req.query('phone') || '').replace(/\D/g, '');
  const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);

  const prayers = leads.filter(
    (l) => l.type === 'pedido_oracao' && (!phone || (l.phone || '').replace(/\D/g, '') === phone)
  );

  return c.json({ success: true, data: prayers });
});

// ─── DOAÇÕES DO APP ──────────────────────────────────────────────────────────

app.post('/api/app/donations', async (c) => {
  await bootstrap(c.env);
  const body: any = await c.req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim().replace(/[^0-9+() -]/g, '');
  const amount = parseFloat(String(body.amount || '0'));
  const txid = String(body.txid || '').trim();

  if (!amount || amount <= 0) {
    return c.json({ success: false, error: 'Valor da doação inválido.' }, 400);
  }

  const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);
  const newDonation = {
    id: id('doacao'),
    name: name || 'Doador Teleios',
    phone,
    amount,
    txid,
    type: 'doacao',
    status: 'PENDENTE',
    createdAt: now(),
    updatedAt: now(),
  };

  leads.unshift(newDonation);
  await putJson(c.env.TELEIOS_KV!, KEY.leads, leads);

  // Atualiza última atividade do usuário
  const appUsers = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.appUsers, []);
  const cleanP = phone.replace(/\D/g, '');
  const uIdx = appUsers.findIndex((u) => (u.phone || '').replace(/\D/g, '') === cleanP);
  if (uIdx >= 0) {
    appUsers[uIdx].lastActivityAt = now();
    await putJson(c.env.TELEIOS_KV!, KEY.appUsers, appUsers);
  }

  return c.json({ success: true, data: newDonation }, 201);
});

app.get('/api/app/donations', async (c) => {
  await bootstrap(c.env);
  const phone = (c.req.query('phone') || '').replace(/\D/g, '');
  const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);

  const donations = leads.filter(
    (l) => l.type === 'doacao' && (!phone || (l.phone || '').replace(/\D/g, '') === phone)
  );

  return c.json({ success: true, data: donations });
});

// ─── CONTROLE FINANCEIRO (ADMIN) ─────────────────────────────────────────────

app.get('/api/financial/summary', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);
  const expenses = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.financialExpenses, []);

  const donations = leads.filter((l) => l.type === 'doacao');

  // Entradas confirmadas vs pendentes
  const entradasConfirmadas = donations
    .filter((d) => d.status === 'CONFIRMADO')
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const entradasPendentes = donations
    .filter((d) => d.status === 'PENDENTE')
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const saidasTotal = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const saldo = entradasConfirmadas - saidasTotal;

  return c.json({
    success: true,
    data: {
      entradasConfirmadas,
      entradasPendentes,
      saidasTotal,
      saldo,
      donations,
      expenses,
    },
  });
});

app.post('/api/financial/expenses', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const body: any = await c.req.json().catch(() => ({}));
  const description = String(body.description || '').trim();
  const amount = parseFloat(String(body.amount || '0'));
  const date = body.date || now().split('T')[0];
  const category = String(body.category || 'Geral').trim();
  const notes = String(body.notes || '').trim();

  if (!description || !amount || amount <= 0) {
    return c.json({ success: false, error: 'Descrição e valor positivo são obrigatórios.' }, 400);
  }

  const expenses = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.financialExpenses, []);
  const newExpense = {
    id: id('despesa'),
    description,
    amount,
    date,
    category,
    notes,
    createdAt: now(),
  };

  expenses.unshift(newExpense);
  await putJson(c.env.TELEIOS_KV!, KEY.financialExpenses, expenses);

  return c.json({ success: true, data: newExpense }, 201);
});

app.delete('/api/financial/expenses/:id', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const expenseId = c.req.param('id');
  const expenses = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.financialExpenses, []);
  const filtered = expenses.filter((e) => e.id !== expenseId);
  await putJson(c.env.TELEIOS_KV!, KEY.financialExpenses, filtered);
  return c.json({ success: true, message: 'Despesa excluída com sucesso.' });
});

app.patch('/api/financial/donations/:id', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const donationId = c.req.param('id');
  const body: any = await c.req.json().catch(() => ({}));
  const leads = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.leads, []);

  const idx = leads.findIndex((l) => l.id === donationId && l.type === 'doacao');
  if (idx === -1) {
    return c.json({ success: false, error: 'Doação não encontrada.' }, 404);
  }

  leads[idx] = {
    ...leads[idx],
    status: body.status || leads[idx].status,
    updatedAt: now(),
  };

  await putJson(c.env.TELEIOS_KV!, KEY.leads, leads);
  return c.json({ success: true, data: leads[idx], message: 'Status atualizado com sucesso.' });
});

// ─── CONFIGURAÇÕES PÚBLICAS & ADMIN ──────────────────────────────────────────

app.get('/api/config/public', async (c) => {
  await bootstrap(c.env);
  const config = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
  return c.json({
    success: true,
    data: {
      pix: config.pix || {
        key: 'pix@ministerioteleios.com.br',
        keyType: 'email',
        receiverName: 'MINISTERIO TELEIOS',
        receiverCity: 'SAO PAULO',
        description: 'Doacao Ministerio Teleios',
      },
    },
  });
});

app.get('/api/config/admin', authMiddleware, requirePermission('config'), async (c) => {
  await bootstrap(c.env);
  const config = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
  const maskedApiKey = config.gemini?.apiKey
    ? `${config.gemini.apiKey.slice(0, 6)}••••••••••••••••${config.gemini.apiKey.slice(-4)}`
    : '';

  return c.json({
    success: true,
    data: {
      pix: config.pix || {
        key: 'pix@ministerioteleios.com.br',
        keyType: 'email',
        receiverName: 'MINISTERIO TELEIOS',
        receiverCity: 'SAO PAULO',
        description: 'Doacao Ministerio Teleios',
      },
      gemini: {
        configured: Boolean(config.gemini?.apiKey),
        apiKeyMasked: maskedApiKey,
        model: config.gemini?.model || 'gemini-1.5-flash',
        status: config.gemini?.status || 'offline',
        lastTestedAt: config.gemini?.lastTestedAt || null,
      },
      googleDrive: {
        mode: config.googleDrive?.mode || (config.googleDrive?.refreshToken ? 'oauth' : 'service_account'),
        configured: Boolean(
          config.googleDrive?.refreshToken ||
          (config.googleDrive?.serviceAccountEmail && config.googleDrive?.privateKey)
        ),
        connected: Boolean(config.googleDrive?.refreshToken),
        clientId: config.googleDrive?.clientId || c.env.GOOGLE_CLIENT_ID || '',
        hasClientSecret: Boolean(config.googleDrive?.clientSecret || c.env.GOOGLE_CLIENT_SECRET),
        clientSecretMasked: (config.googleDrive?.clientSecret || c.env.GOOGLE_CLIENT_SECRET)
          ? `${(config.googleDrive?.clientSecret || c.env.GOOGLE_CLIENT_SECRET).slice(0, 6)}••••••••${(config.googleDrive?.clientSecret || c.env.GOOGLE_CLIENT_SECRET).slice(-4)}`
          : '',
        redirectUri: config.googleDrive?.redirectUri || `${new URL(c.req.url).origin}/api/auth/google/callback`,
        serviceAccountEmail: config.googleDrive?.serviceAccountEmail || '',
        hasPrivateKey: Boolean(config.googleDrive?.privateKey),
        rootFolderId: config.googleDrive?.rootFolderId || '',
        rootFolderName: config.googleDrive?.rootFolderName || 'Teleios',
        status: config.googleDrive?.status || 'offline',
        lastTestedAt: config.googleDrive?.lastTestedAt || null,
        lastError: config.googleDrive?.lastError || null,
        user: config.googleDrive?.user || null,
        quota: config.googleDrive?.quota || null,
        rootFolder: config.googleDrive?.rootFolder || null,
      },
      whatsapp: {
        configured: Boolean(config.whatsapp?.defaultChannelJid),
        defaultChannelJid: config.whatsapp?.defaultChannelJid || '',
        defaultChannelName: config.whatsapp?.defaultChannelName || '',
        defaultChannelType: config.whatsapp?.defaultChannelType || 'group',
        autoDispatchEnabled: config.whatsapp?.autoDispatchEnabled ?? false,
      },
    },
  });
});

app.put('/api/config/admin', authMiddleware, requirePermission('config'), async (c) => {
  await bootstrap(c.env);
  const body = await c.req.json<any>();
  const currentConfig = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});

  const newConfig = {
    ...currentConfig,
    pix: body.pix ? { ...currentConfig.pix, ...body.pix } : currentConfig.pix,
    gemini: body.gemini
      ? {
          ...currentConfig.gemini,
          ...body.gemini,
          apiKey: body.gemini.apiKey ? body.gemini.apiKey : currentConfig.gemini?.apiKey,
        }
      : currentConfig.gemini,
    googleDrive: body.googleDrive
      ? {
          ...currentConfig.googleDrive,
          ...body.googleDrive,
          clientId: body.googleDrive.clientId !== undefined ? body.googleDrive.clientId.trim() : currentConfig.googleDrive?.clientId,
          clientSecret: (body.googleDrive.clientSecret && !body.googleDrive.clientSecret.includes('••••'))
            ? body.googleDrive.clientSecret.trim()
            : currentConfig.googleDrive?.clientSecret,
          redirectUri: body.googleDrive.redirectUri ? body.googleDrive.redirectUri.trim() : currentConfig.googleDrive?.redirectUri,
          privateKey: (body.googleDrive.privateKey && !body.googleDrive.privateKey.includes('••••'))
            ? body.googleDrive.privateKey
            : currentConfig.googleDrive?.privateKey,
        }
      : currentConfig.googleDrive,
    whatsapp: body.whatsapp
      ? {
          ...currentConfig.whatsapp,
          ...body.whatsapp,
        }
      : currentConfig.whatsapp,
  };

  await putJson(c.env.TELEIOS_KV!, KEY.config, newConfig);
  return c.json({ success: true, message: 'Configurações salvas com sucesso.' });
});

// ─── TESTE DE INTEGRAÇÃO REAL: GEMINI & DRIVE ─────────────────────────────────

app.post('/api/integrations/gemini/test', authMiddleware, requirePermission('config'), async (c) => {
  await bootstrap(c.env);
  const body: any = await c.req.json().catch(() => ({}));
  const currentConfig = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
  const keyToTest = body.apiKey || currentConfig.gemini?.apiKey;
  const modelToTest = body.model || currentConfig.gemini?.model || 'gemini-1.5-flash';

  if (!keyToTest) {
    return c.json({ success: false, error: 'Nenhuma chave de API configurada para o Google Gemini.' }, 400);
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTest}:generateContent?key=${keyToTest}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Responda apenas: Conectado com sucesso.' }] }],
      }),
    });
    const data = await res.json<any>();
    if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      currentConfig.gemini = {
        ...currentConfig.gemini,
        configured: true,
        status: 'online',
        lastTestedAt: now(),
      };
      await putJson(c.env.TELEIOS_KV!, KEY.config, currentConfig);
      return c.json({
        success: true,
        message: 'Conexão com Google Gemini realizada com sucesso!',
        model: modelToTest,
        response: data.candidates[0].content.parts[0].text.trim(),
      });
    } else {
      const errDetail = data.error?.message || 'Falha ao validar chave de API do Gemini.';
      currentConfig.gemini = {
        ...currentConfig.gemini,
        status: 'error',
        lastTestedAt: now(),
      };
      await putJson(c.env.TELEIOS_KV!, KEY.config, currentConfig);
      return c.json({ success: false, error: errDetail }, 400);
    }
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Erro de rede ao conectar com Google Gemini.' }, 500);
  }
});

// Helpers para Drive Credentials e persistência de Token renovado
function getDriveCredentials(config: any, env: Bindings): GoogleDriveCredentials {
  const drive = config.googleDrive || {};
  return {
    mode: drive.mode || (drive.refreshToken ? 'oauth' : 'service_account'),
    clientId: drive.clientId || env.GOOGLE_CLIENT_ID,
    clientSecret: drive.clientSecret || env.GOOGLE_CLIENT_SECRET,
    redirectUri: drive.redirectUri,
    accessToken: drive.accessToken,
    refreshToken: drive.refreshToken,
    expiresAt: drive.expiresAt,
    serviceAccountEmail: drive.serviceAccountEmail,
    privateKey: drive.privateKey,
    rootFolderId: drive.rootFolderId,
    rootFolderName: drive.rootFolderName,
    projectId: drive.projectId,
  };
}

function createTokenRefreshedCallback(env: Bindings, currentConfig: any) {
  return async (newToken: string, newExpiresAt: number) => {
    if (env.TELEIOS_KV && currentConfig.googleDrive) {
      currentConfig.googleDrive.accessToken = newToken;
      currentConfig.googleDrive.expiresAt = newExpiresAt;
      await putJson(env.TELEIOS_KV, KEY.config, currentConfig);
    }
  };
}

// ─── GOOGLE OAUTH 2.0 CALLBACK (PÚBLICO) ──────────────────────────────────────

app.get('/api/auth/google/callback', async (c) => {
  await bootstrap(c.env);
  const code = c.req.query('code');
  const error = c.req.query('error');
  const stateStr = c.req.query('state') || '';

  let adminOrigin = 'https://teleios-admin.pages.dev';
  try {
    if (stateStr) {
      const decoded = JSON.parse(atob(stateStr.replace(/-/g, '+').replace(/_/g, '/')));
      if (decoded.origin) adminOrigin = decoded.origin;
    }
  } catch {}

  if (error) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"/><title>Google Drive Conexão</title></head>
        <body style="font-family: system-ui, sans-serif; background: #0A0F1A; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center; padding: 2rem; background: #111827; border-radius: 1rem; border: 1px solid #f43f5e; max-width: 420px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h2 style="color: #fb7185; margin-top: 0;">Autorização Cancelada</h2>
            <p style="color: #9ca3af; font-size: 14px;">O acesso ao Google Drive foi cancelado ou recusado: <strong>${error}</strong></p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_DRIVE_AUTH_ERROR', error: '${error}' }, '*');
                setTimeout(() => window.close(), 2500);
              } else {
                setTimeout(() => { window.location.href = '${adminOrigin}/#/integracoes?tab=drive&error=${encodeURIComponent(error)}'; }, 2000);
              }
            </script>
          </div>
        </body>
      </html>
    `, 400);
  }

  if (!code) {
    return c.html(`<h3>Código de autorização não recebido do Google.</h3>`, 400);
  }

  const currentConfig = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
  const drive = currentConfig.googleDrive || {};
  const clientId = drive.clientId || c.env.GOOGLE_CLIENT_ID;
  const clientSecret = drive.clientSecret || c.env.GOOGLE_CLIENT_SECRET;
  const workerOrigin = new URL(c.req.url).origin;
  const redirectUri = drive.redirectUri || `${workerOrigin}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return c.html(`
      <div style="font-family: system-ui, sans-serif; padding: 2rem; background: #111827; color: #fff; max-width: 500px; margin: 2rem auto; border-radius: 1rem; border: 1px solid #f87171;">
        <h2 style="color: #f87171; margin-top: 0;">Client ID ou Client Secret ausente</h2>
        <p style="color: #9ca3af;">Configure o Client ID e Client Secret em Integrações &gt; Google Drive no painel antes de autorizar.</p>
        <a href="${adminOrigin}/#/integracoes?tab=drive" style="color: #fbbf24;">Voltar ao Painel</a>
      </div>
    `, 400);
  }

  try {
    const tokens = await exchangeOAuthCodeForTokens(code, clientId, clientSecret, redirectUri);
    const aboutData = await fetchDriveAbout(tokens.accessToken);

    currentConfig.googleDrive = {
      ...drive,
      mode: 'oauth',
      configured: true,
      status: 'online',
      clientId,
      clientSecret,
      redirectUri,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || drive.refreshToken,
      expiresAt: Date.now() + (tokens.expiresIn * 1000),
      tokenType: tokens.tokenType,
      scope: tokens.scope,
      user: aboutData.user || null,
      quota: aboutData.quota || null,
      lastTestedAt: now(),
      lastError: null,
    };
    await putJson(c.env.TELEIOS_KV!, KEY.config, currentConfig);

    const userEmail = aboutData.user?.emailAddress || '';
    const displayName = aboutData.user?.displayName || 'Usuário Google';

    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"/><title>Google Drive Conectado!</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0F1A; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center; padding: 2.5rem; background: #111827; border-radius: 1.25rem; border: 1px solid #10b981; max-width: 440px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
            <div style="width: 56px; height: 56px; background: rgba(16, 185, 129, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; color: #34d399; font-size: 28px;">✓</div>
            <h2 style="color: #34d399; margin: 0 0 0.5rem; font-size: 20px;">Google Drive Conectado!</h2>
            <p style="color: #9ca3af; font-size: 14px; margin-bottom: 0.5rem;">Conta conectada: <strong style="color: #fff;">${userEmail}</strong></p>
            <p style="color: #6b7280; font-size: 12px; margin-bottom: 1.5rem;">Sincronização offline ativa com Refresh Token.</p>
            <p style="color: #6b7280; font-size: 12px;">Esta janela será fechada automaticamente...</p>
            <script>
              const payload = {
                type: 'GOOGLE_DRIVE_AUTH_SUCCESS',
                email: '${userEmail}',
                displayName: '${displayName}',
                user: ${JSON.stringify(aboutData.user || {})},
                quota: ${JSON.stringify(aboutData.quota || {})}
              };
              if (window.opener) {
                window.opener.postMessage(payload, '*');
                setTimeout(() => { window.close(); }, 1200);
              } else {
                setTimeout(() => {
                  window.location.href = '${adminOrigin}/#/integracoes?tab=drive&auth=success&email=' + encodeURIComponent('${userEmail}');
                }, 1500);
              }
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    return c.html(`
      <div style="font-family: system-ui, sans-serif; padding: 2rem; background: #111827; color: #fff; max-width: 500px; margin: 2rem auto; border-radius: 1rem; border: 1px solid #f87171;">
        <h2 style="color: #f87171; margin-top: 0;">Erro na Autenticação OAuth2</h2>
        <p style="color: #9ca3af;">${err.message}</p>
        <p><a href="${adminOrigin}/#/integracoes?tab=drive" style="color: #fbbf24;">Voltar ao Painel</a></p>
      </div>
    `, 500);
  }
});

// ─── ENDPOINT PARA GERAR URL DO GOOGLE OAUTH ─────────────────────────────────

app.get('/api/integrations/drive/auth-url', authMiddleware, requirePermission('config'), async (c) => {
  await bootstrap(c.env);
  const currentConfig = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
  const drive = currentConfig.googleDrive || {};
  const clientId = drive.clientId || c.env.GOOGLE_CLIENT_ID;
  const clientSecret = drive.clientSecret || c.env.GOOGLE_CLIENT_SECRET;

  const workerOrigin = new URL(c.req.url).origin;
  const redirectUri = drive.redirectUri || `${workerOrigin}/api/auth/google/callback`;
  const adminOrigin = c.req.query('adminOrigin') || c.req.header('Origin') || 'https://teleios-admin.pages.dev';

  if (!clientId || !clientSecret) {
    return c.json({
      success: false,
      error: 'Client ID e Client Secret do Google OAuth precisam ser configurados primeiro.',
      redirectUri,
    }, 400);
  }

  const stateObj = { origin: adminOrigin, timestamp: Date.now() };
  const state = btoa(JSON.stringify(stateObj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const authUrl = buildGoogleOAuthUrl({
    clientId,
    redirectUri,
    state,
  });

  return c.json({
    success: true,
    authUrl,
    redirectUri,
    clientId,
  });
});

// ─── ENDPOINT PARA DESCONECTAR GOOGLE DRIVE ───────────────────────────────────

app.post('/api/integrations/drive/disconnect', authMiddleware, requirePermission('config'), async (c) => {
  await bootstrap(c.env);
  const currentConfig = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
  const drive = currentConfig.googleDrive || {};

  if (drive.accessToken) {
    await revokeGoogleToken(drive.accessToken);
  } else if (drive.refreshToken) {
    await revokeGoogleToken(drive.refreshToken);
  }

  currentConfig.googleDrive = {
    ...drive,
    configured: false,
    status: 'offline',
    accessToken: null,
    refreshToken: null,
    user: null,
    quota: null,
    lastTestedAt: now(),
    lastError: null,
  };
  await putJson(c.env.TELEIOS_KV!, KEY.config, currentConfig);

  return c.json({ success: true, message: 'Google Drive desconectado com sucesso.' });
});

// ─── TESTE DE CONEXÃO GOOGLE DRIVE (OAUTH & SERVICE ACCOUNT) ──────────────────

app.post('/api/integrations/drive/test', authMiddleware, requirePermission('config'), async (c) => {
  await bootstrap(c.env);
  const body = await c.req.json<any>().catch(() => ({}));
  const currentConfig = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
  const drive = {
    ...(currentConfig.googleDrive || {}),
    ...(body || {}),
  };

  const isOAuth = drive.mode === 'oauth' || Boolean(drive.refreshToken);
  const hasServiceAccount = Boolean(drive.serviceAccountEmail && drive.privateKey);

  if (!isOAuth && !hasServiceAccount) {
    return c.json({
      success: false,
      configured: false,
      error: 'Google Drive não está conectado via OAuth nem possui credenciais de Service Account. Clique em "Conectar meu Google Drive" para autorizar.',
    }, 400);
  }

  const credentials = getDriveCredentials({ googleDrive: drive }, c.env);
  const onRefreshed = createTokenRefreshedCallback(c.env, currentConfig);

  const testResult = await testGoogleDriveConnection(credentials, onRefreshed);

  currentConfig.googleDrive = {
    ...drive,
    configured: testResult.success,
    status: testResult.success ? 'online' : 'error',
    lastTestedAt: now(),
    lastError: testResult.success ? null : (testResult.error || testResult.message),
    user: testResult.user || null,
    quota: testResult.quota || null,
    rootFolder: testResult.rootFolder || null,
  };
  await putJson(c.env.TELEIOS_KV!, KEY.config, currentConfig);

  return c.json({
    success: testResult.success,
    mode: testResult.mode || (isOAuth ? 'oauth' : 'service_account'),
    message: testResult.message,
    configured: testResult.success,
    account: testResult.user?.emailAddress || drive.serviceAccountEmail || 'Google Drive',
    user: testResult.user,
    quota: testResult.quota,
    rootFolder: testResult.rootFolder,
    error: testResult.error,
  }, testResult.success ? 200 : 400);
});

// ─── LISTAGEM DE ARQUIVOS E PASTAS DO GOOGLE DRIVE ────────────────────────────

app.get('/api/integrations/drive/files', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const currentConfig = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
  const credentials = getDriveCredentials(currentConfig, c.env);

  const isConfigured = Boolean(credentials.refreshToken || (credentials.serviceAccountEmail && credentials.privateKey));
  if (!isConfigured) {
    return c.json({
      success: false,
      error: 'Google Drive ainda não conectado. Acesse Integrações > Google Drive e autorize o acesso.',
    }, 400);
  }

  const folderId = c.req.query('folderId') || undefined;
  const search = c.req.query('search') || undefined;
  const filter = c.req.query('filter') || undefined;
  const pageToken = c.req.query('pageToken') || undefined;
  const pageSize = Number(c.req.query('pageSize')) || 40;

  try {
    const onRefreshed = createTokenRefreshedCallback(c.env, currentConfig);
    const result = await listGoogleDriveFiles(
      credentials,
      { folderId, search, mimeTypeFilter: filter, pageToken, pageSize },
      onRefreshed
    );

    return c.json({
      success: true,
      files: result.files,
      nextPageToken: result.nextPageToken,
      rootFolderId: credentials.rootFolderId,
      rootFolderName: credentials.rootFolderName || 'Google Drive',
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ─── OBTER CONTEÚDO DE ARQUIVO DO GOOGLE DRIVE ────────────────────────────────

app.get('/api/integrations/drive/files/:id/content', authMiddleware, async (c) => {
  await bootstrap(c.env);
  const currentConfig = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
  const credentials = getDriveCredentials(currentConfig, c.env);

  const isConfigured = Boolean(credentials.refreshToken || (credentials.serviceAccountEmail && credentials.privateKey));
  if (!isConfigured) {
    return c.json({ success: false, error: 'Google Drive não conectado.' }, 400);
  }

  const fileId = c.req.param('id');
  if (!fileId) {
    return c.json({ success: false, error: 'ID do arquivo é obrigatório.' }, 400);
  }
  try {
    const onRefreshed = createTokenRefreshedCallback(c.env, currentConfig);
    const result = await downloadGoogleDriveFileContent(credentials, fileId, onRefreshed);

    return c.json({
      success: true,
      name: result.name,
      mimeType: result.mimeType,
      textContent: result.textContent,
      size: result.buffer.byteLength,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Importar arquivo diretamente do Google Drive para a plataforma Teleios
app.post('/api/integrations/drive/import', authMiddleware, requirePermission('ingest'), async (c) => {
  await bootstrap(c.env);
  const body = await c.req.json<{
    fileId: string;
    category?: string;
    title?: string;
    autoDispatchWhatsapp?: boolean;
    channelId?: string;
    targetPhone?: string;
  }>();

  if (!body.fileId) {
    return c.json({ success: false, error: 'fileId é obrigatório.' }, 400);
  }

  const currentConfig = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
  const credentials = getDriveCredentials(currentConfig, c.env);

  const isConfigured = Boolean(credentials.refreshToken || (credentials.serviceAccountEmail && credentials.privateKey));
  if (!isConfigured) {
    return c.json({ success: false, error: 'Google Drive não conectado.' }, 400);
  }

  try {
    const onRefreshed = createTokenRefreshedCallback(c.env, currentConfig);
    const driveFile = await getGoogleDriveFile(credentials, body.fileId, onRefreshed);
    const downloaded = await downloadGoogleDriveFileContent(credentials, body.fileId, onRefreshed);

    const category = body.category || (driveFile.mimeType.startsWith('image/') ? 'GALERIA' : driveFile.mimeType.startsWith('video/') ? 'VIDEO' : 'ESTUDO');
    const fileId = id('file');
    const title = body.title || driveFile.name.replace(/\.[^.]+$/, '');
    const r2Key = `${fileId}/${driveFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // Se houver R2 disponível e o arquivo tiver bytes, armazena no R2 para CDN
    if (c.env.TELEIOS_MEDIA && downloaded.buffer.byteLength > 0 && downloaded.buffer.byteLength < 50 * 1024 * 1024) {
      await c.env.TELEIOS_MEDIA.put(r2Key, downloaded.buffer, {
        httpMetadata: { contentType: downloaded.mimeType },
      }).catch(() => {});
    }

    const mediaFile: MediaFile = {
      id: fileId,
      originalName: driveFile.name,
      mimeType: downloaded.mimeType,
      size: downloaded.buffer.byteLength || driveFile.size || 0,
      category,
      driveFileId: driveFile.id,
      driveWebViewLink: driveFile.webViewLink,
      driveFolderPath: credentials.rootFolderName || 'GoogleDrive',
      status: category === 'ESTUDO' ? 'COMPLETED' : 'COMPLETED',
      createdAt: now(),
      r2Key,
    };

    const files = await getJson<MediaFile[]>(c.env.TELEIOS_KV!, KEY.files, []);
    files.unshift(mediaFile);
    await putJson(c.env.TELEIOS_KV!, KEY.files, files);

    let studyCreated: any = null;
    let dispatchedToWhatsapp = false;

    if (category === 'ESTUDO') {
      const rawContent = downloaded.textContent || `Estudo importado do Google Drive: ${driveFile.name}\nVisualizar no Drive: ${driveFile.webViewLink}`;
      let summary: string | null = null;
      let aiImagePrompt: string | null = null;

      // Se Gemini configurado, sintetiza o estudo
      if (currentConfig.gemini?.apiKey) {
        try {
          const geminiModel = currentConfig.gemini.model || 'gemini-1.5-flash';
          const prompt = `Você é um pastor e teólogo bíblico. Analise o seguinte texto e gere:
1. Um resumo devocional edificante e conciso (máximo 4 parágrafos) formatado para leitura no WhatsApp.
2. Um prompt curto em inglês para gerar uma imagem bíblica representativa (ex: 'biblical scene, photorealistic, cinematic').
Retorne no formato JSON com as chaves: "summary" e "aiImagePrompt".

Texto do estudo:
${rawContent.slice(0, 8000)}`;

          const gRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${currentConfig.gemini.apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            }
          );
          if (gRes.ok) {
            const gData = await gRes.json<any>();
            const textResponse = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              summary = parsed.summary || null;
              aiImagePrompt = parsed.aiImagePrompt || null;
            } else {
              summary = textResponse.trim();
            }
          }
        } catch (aiErr) {
          console.warn('[Gemini AI Synthesis Error]', aiErr);
        }
      }

      studyCreated = {
        id: id('study'),
        fileId,
        title,
        type: 'Estudo',
        status: 'PUBLICADO',
        published: true,
        rawContent,
        content: rawContent,
        summary: summary || rawContent.slice(0, 500),
        aiImagePrompt,
        generatedImgUrl: driveFile.thumbnailLink || null,
        scheduledAt: null,
        sentToWhatsapp: false,
        sentAt: null,
        createdAt: now(),
        mediaFile,
      };

      const studies = await getJson<Study[]>(c.env.TELEIOS_KV!, KEY.studies, []);
      studies.unshift(studyCreated);
      await putJson(c.env.TELEIOS_KV!, KEY.studies, studies);

      // Disparo automático para WhatsApp se solicitado
      if (body.autoDispatchWhatsapp) {
        try {
          const channels = await getJson<any[]>(c.env.TELEIOS_KV!, KEY.channels, []);
          let channelId = body.channelId;
          let recipientJid = '';

          if (channelId) {
            recipientJid = channelId.includes('@') ? channelId : `${channelId}@g.us`;
          } else if (body.targetPhone) {
            const clean = body.targetPhone.replace(/\D/g, '');
            recipientJid = `${clean}@s.whatsapp.net`;
          } else if (currentConfig.whatsapp?.defaultChannelJid) {
            recipientJid = currentConfig.whatsapp.defaultChannelJid;
          } else if (channels.length > 0) {
            recipientJid = channels[0].jid || channels[0].whatsappJid || `${channels[0].id}@g.us`;
          }

          if (recipientJid) {
            const messageText = `📖 *${title}*\n\n${summary || rawContent.slice(0, 400)}\n\n🔗 *Acesse o conteúdo completo no Google Drive:*\n${driveFile.webViewLink}`;

            const job: Job = {
              id: id('job'),
              studyId: studyCreated.id,
              channelId: channelId || 'direct_message',
              agentId: 'agent_local_001',
              recipientJid,
              content: messageText,
              mediaUrl: driveFile.thumbnailLink || undefined,
              scheduledAt: null,
              status: 'READY',
              attempts: 0,
              createdAt: now(),
              updatedAt: now(),
            };

            const jobs = await getJson<Job[]>(c.env.TELEIOS_KV!, KEY.jobs, []);
            jobs.unshift(job);
            await Promise.all([
              putJson(c.env.TELEIOS_KV!, KEY.jobs, jobs),
              putJson(c.env.TELEIOS_KV!, `${KEY.jobs}:${job.id}`, job),
            ]);

            const stub = getCoordinatorStub(c.env);
            const url = new URL(c.req.url);
            url.pathname = '/dispatch';
            await stub.fetch(new Request(url.toString(), {
              method: 'POST',
              body: JSON.stringify(job),
              headers: { 'Content-Type': 'application/json' },
            })).catch(() => {});

            studyCreated.sentToWhatsapp = true;
            studyCreated.sentAt = now();
            await putJson(c.env.TELEIOS_KV!, KEY.studies, studies);
            dispatchedToWhatsapp = true;
          }
        } catch (waErr) {
          console.warn('[WhatsApp Auto-Dispatch Error]', waErr);
        }
      }
    } else if (category === 'VIDEO') {
      const videos = await getJson<Video[]>(c.env.TELEIOS_KV!, KEY.videos, []);
      const video = {
        id: id('video'),
        fileId,
        title,
        description: `Importado do Google Drive: ${driveFile.webViewLink}`,
        scheduledAt: null,
        published: true,
        youtubeUrl: driveFile.webViewLink,
      };
      videos.unshift(video);
      await putJson(c.env.TELEIOS_KV!, KEY.videos, videos);
    }

    return c.json({
      success: true,
      message: `Arquivo "${driveFile.name}" importado do Google Drive com sucesso!${dispatchedToWhatsapp ? ' E disparado para o WhatsApp.' : ''}`,
      mediaFile,
      study: studyCreated,
      dispatchedToWhatsapp,
    }, 201);
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Falha ao importar arquivo do Google Drive.' }, 500);
  }
});

// Upload direto da plataforma para o Google Drive
app.post('/api/integrations/drive/upload', authMiddleware, requirePermission('ingest'), async (c) => {
  await bootstrap(c.env);
  const currentConfig = await getJson<any>(c.env.TELEIOS_KV!, KEY.config, {});
  const credentials = getDriveCredentials(currentConfig, c.env);

  const isConfigured = Boolean(credentials.refreshToken || (credentials.serviceAccountEmail && credentials.privateKey));
  if (!isConfigured) {
    return c.json({ success: false, error: 'Google Drive não configurado com credenciais válidas.' }, 400);
  }

  try {
    const form = await c.req.formData();
    const file = form.get('file') as unknown as File | null;
    const textContent = String(form.get('textContent') || '');
    const fileName = file?.name || String(form.get('fileName') || `upload_${Date.now()}.txt`);
    const mimeType = file?.type || String(form.get('mimeType') || 'text/plain');

    const contentBuffer = file ? await file.arrayBuffer() : textContent;
    const onRefreshed = createTokenRefreshedCallback(c.env, currentConfig);

    const uploadResult = await uploadFileToGoogleDrive(
      credentials,
      {
        fileName,
        mimeType,
        content: contentBuffer,
      },
      onRefreshed
    );

    return c.json({
      success: true,
      message: `Arquivo "${fileName}" enviado para o Google Drive com sucesso!`,
      fileId: uploadResult.driveFileId,
      webViewLink: uploadResult.webViewLink,
    }, 201);
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Falha ao fazer upload para o Google Drive.' }, 500);
  }
});

export default {
  fetch(req: Request, env: Bindings, ctx: ExecutionContext) {
    return app.fetch(req, env, ctx);
  },
  async scheduled(event: any, env: Bindings, ctx: ExecutionContext) {
    try {
      if (env.TELEIOS_KV) {
        const nowMs = Date.now();
        const studies = await getJson<Study[]>(env.TELEIOS_KV, KEY.studies, []);
        let updated = false;
        studies.forEach((s) => {
          if ((s.status === 'AGENDADO' || !s.published) && s.scheduledAt && new Date(s.scheduledAt).getTime() <= nowMs) {
            s.status = 'PUBLICADO';
            s.published = true;
            updated = true;
          }
        });
        if (updated) {
          await putJson(env.TELEIOS_KV, KEY.studies, studies);
        }
      }
    } catch (e) {
      console.error('[Cron] Falha ao publicar estudos agendados:', e);
    }

    try {
      const stub = getCoordinatorStub(env);
      await stub.fetch('http://internal/alarm');
    } catch (e) {
      console.error('[Cron] Failed to trigger DO alarm:', e);
    }
  },
};
