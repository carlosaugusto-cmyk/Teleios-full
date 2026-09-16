/**
 * API wrapper — todas as chamadas ao Worker existente.
 * Não cria endpoints novos. Apenas consome os públicos mapeados.
 */
import { createImageThumbnail, optimizeImage } from './imageOptimizer';

const PRODUCTION_API_URL = 'https://teleios-api-worker.ca88321499.workers.dev';
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? PRODUCTION_API_URL : '');

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  count?: number;
  error?: string;
  message?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  return res.json() as Promise<ApiResponse<T>>;
}

// ─── Tipos baseados no modelo de dados real do Worker ────────────────────────

export interface Study {
  id: string;
  fileId: string;
  title: string;
  type: 'Devocional' | 'Estudo' | 'Vídeo' | 'Imagem' | 'Áudio' | 'Documento';
  status: 'PUBLICADO' | 'RASCUNHO' | 'AGENDADO';
  published: boolean;
  rawContent: string;
  content: string;
  summary: string | null;
  topic: string | null;
  generatedImgUrl: string | null;
  thumbnailUrl?: string | null;
  aiImageUrl?: string | null;
  videoUrl?: string | null;
  scheduledAt: string | null;
  mediaFile?: any;
  documentUrl?: string | null;
  documentName?: string | null;
  documentType?: 'pdf' | 'docx' | 'doc' | string | null;
  documentSize?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  type: 'pedido_oracao' | 'doacao' | 'app_user';
  status: string;
  amount?: number;
  receiptProvided?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PixConfig {
  key: string;
  keyType: string;
  receiverName: string;
  receiverCity: string;
  description: string;
}

export interface UserProfile {
  id?: string;
  name: string;
  username?: string | null;
  email?: string | null;
  password?: string;
  phone: string;
  church?: string;
  birthDate?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  ministry?: string | null;
  city?: string;
  state?: string;
  photoUrl?: string | null;
  role?: 'admin' | 'user' | string;
  isAdmin?: boolean;
  isBaptized?: boolean;
  timeAsBeliever?: string;
  inDiscipleship?: boolean;
  disciplerName?: string;
  notes?: string;
  status?: string;
  readDevocionais?: number;
  readEstudos?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrayerItem {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  title: string;
  request: string;
  date: string;
  status: 'PENDENTE' | 'EM_ORACAO' | 'ATENDIDO';
  createdAt?: string;
}

export interface DonationItem {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  amount: number;
  txid?: string;
  status: 'PENDENTE' | 'CONFIRMADO' | 'CANCELADO';
  createdAt?: string;
}

export function resolveDocumentUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `${PRODUCTION_API_URL}${trimmed}`;
  }
  return `${PRODUCTION_API_URL}/${trimmed}`;
}

export function normalizeStudy(s: Study): Study {
  let docUrl = s.documentUrl || null;
  let docName = s.documentName || null;
  let docType = s.documentType || null;
  let docSize = s.documentSize || null;

  // Fallback se não vier documentUrl explicitamente mas estiver no mediaFile
  if (!docUrl && s.mediaFile) {
    if (s.mediaFile.category === 'DOCUMENTO' || s.mediaFile.originalName?.match(/\.(pdf|docx?)$/i)) {
      docUrl = s.mediaFile.driveWebViewLink || (s.mediaFile.r2Key ? `/api/media/${s.mediaFile.id}` : `/api/media/${s.mediaFile.id}`);
      docName = docName || s.mediaFile.originalName;
      docSize = docSize || s.mediaFile.size;
    }
  }

  // Fallback se houver indicação de anexo no texto
  if (!docUrl) {
    const text = `${s.content || ''} ${s.rawContent || ''}`;
    const match = text.match(/Documento anexado:\s*([^\r\n]+)/i);
    if (match) {
      const detectedName = match[1].trim();
      docName = docName || detectedName;
      if (s.fileId && !s.fileId.startsWith('text_')) {
        docUrl = `/api/media/${s.fileId}`;
      }
    }
  }

  if (docUrl) {
    docUrl = resolveDocumentUrl(docUrl);
    if (!docType && docName) {
      const ext = docName.split('.').pop()?.toLowerCase();
      if (ext === 'pdf' || ext === 'docx' || ext === 'doc') {
        docType = ext;
      }
    }
  }

  return {
    ...s,
    documentUrl: docUrl,
    documentName: docName,
    documentType: (docType as any) || (docUrl ? 'pdf' : null),
    documentSize: docSize,
  };
}

// ─── Funções do Theleios-app ─────────────────────────────────────────────────

/** Lista todos os estudos/devocionais publicados (endpoint público, sem auth) */
export async function fetchEstudos(): Promise<Study[]> {
  const res = await request<Study[]>('/api/estudos');
  if (res.success && Array.isArray(res.data)) return res.data.map(normalizeStudy);
  return [];
}

/** Obtém um estudo/devocional por ID (endpoint público, sem auth) */
export async function fetchEstudo(id: string): Promise<Study | null> {
  const res = await request<Study>(`/api/estudos/${encodeURIComponent(id)}`);
  if (res.success && res.data) return normalizeStudy(res.data);
  return null;
}

/** Cadastro de novo usuário no App com email, username, senha e telefone */
export async function registerAppUser(data: Partial<UserProfile> & { password?: string }): Promise<ApiResponse<UserProfile>> {
  return request<UserProfile>('/api/app/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Login de usuário no App por email, username ou telefone + senha */
export async function loginAppUser(identifier: string, password?: string): Promise<ApiResponse<UserProfile>> {
  return request<UserProfile>('/api/app/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

/** Busca perfil do usuário no Cloudflare Worker por telefone, username ou email */
export async function fetchUserProfile(phoneOrIdentifier: string): Promise<UserProfile | null> {
  const query = phoneOrIdentifier.includes('@')
    ? `email=${encodeURIComponent(phoneOrIdentifier.trim())}`
    : phoneOrIdentifier.startsWith('@') || /^[a-zA-Z]/.test(phoneOrIdentifier)
    ? `username=${encodeURIComponent(phoneOrIdentifier.replace(/^@/, '').trim())}`
    : `phone=${encodeURIComponent(phoneOrIdentifier.replace(/\D/g, ''))}`;

  try {
    const res = await request<UserProfile>(`/api/app/profile?${query}`);
    if (res.success && res.data) return res.data;
    return null;
  } catch {
    return null;
  }
}

/** Salva / atualiza perfil do usuário no Cloudflare Worker */
export async function saveUserProfile(profile: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
  return request<UserProfile>('/api/app/profile', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
}

/** Envia novo pedido de oração estruturado para o backend */
export async function submitAppPrayer(data: {
  userId?: string;
  name: string;
  phone: string;
  title: string;
  request: string;
  date?: string;
}): Promise<ApiResponse<PrayerItem>> {
  return request<PrayerItem>('/api/app/prayers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Busca histórico de orações do usuário pelo telefone ou userId */
export async function fetchUserPrayers(phone: string, userId?: string): Promise<PrayerItem[]> {
  const query = new URLSearchParams();
  if (phone) query.set('phone', phone);
  if (userId) query.set('userId', userId);
  const res = await request<PrayerItem[]>(`/api/app/prayers?${query.toString()}`);
  if (res.success && Array.isArray(res.data)) return res.data;
  return [];
}

/** Registra nova doação PIX no backend */
export async function submitAppDonation(data: {
  userId?: string;
  name: string;
  phone: string;
  amount: number;
  txid?: string;
}): Promise<ApiResponse<DonationItem>> {
  return request<DonationItem>('/api/app/donations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Busca histórico de doações do usuário pelo telefone ou userId */
export async function fetchUserDonations(phone: string, userId?: string): Promise<DonationItem[]> {
  const query = new URLSearchParams();
  if (phone) query.set('phone', phone);
  if (userId) query.set('userId', userId);
  const res = await request<DonationItem[]>(`/api/app/donations?${query.toString()}`);
  if (res.success && Array.isArray(res.data)) return res.data;
  return [];
}

/** Envia pedido de oração (endpoint de compatibilidade) */
export async function submitPedidoOracao(data: { name: string; phone: string }): Promise<ApiResponse<Lead>> {
  return request<Lead>('/api/leads/oracao', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Registra doação (endpoint de compatibilidade) */
export async function submitDoacao(data: { name: string; phone: string; amount: number }): Promise<ApiResponse<Lead>> {
  return request<Lead>('/api/leads/doacao', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Obtém configuração pública de PIX (endpoint público, sem auth) */
export async function fetchConfigPublic(): Promise<{ pix: PixConfig } | null> {
  const res = await request<{ pix: PixConfig }>('/api/config/public');
  if (res.success && res.data) return res.data;
  return null;
}

/** Verifica se a API está online */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Faz upload de documento ou imagem para o Worker com autorização de Admin */
export async function uploadMediaFromApp(
  file: File,
  adminPhone?: string,
  category: 'DOCUMENTO' | 'GALERIA' = 'DOCUMENTO',
  adminIdentifier?: string
): Promise<{ url: string; thumbnailUrl?: string; id: string; originalName: string; size: number; ext: string } | null> {
  try {
    const isImage = file.type.startsWith('image/');
    let finalFile = file;
    let thumbFile: File | null = null;

    if (isImage) {
      try {
        const [opt, thumb] = await Promise.all([
          optimizeImage(file),
          createImageThumbnail(file, 500, 0.82),
        ]);
        finalFile = opt;
        thumbFile = thumb;
      } catch (imgErr) {
        console.warn('[Image optimize warning]', imgErr);
      }
    }

    const formData = new FormData();
    formData.append('file', finalFile);
    formData.append('fileName', file.name);
    formData.append('category', category);
    if (thumbFile) {
      formData.append('thumbnail', thumbFile);
    }

    const headers: Record<string, string> = {};
    if (adminPhone) headers['X-App-Admin-Phone'] = adminPhone;
    if (adminIdentifier) headers['X-App-Admin-User'] = adminIdentifier;

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const json = await res.json();
    if (json.success && json.mediaFile) {
      const url = json.mediaFile.driveWebViewLink || (json.mediaFile.id ? `${BASE_URL}/api/media/${json.mediaFile.id}` : null);
      const thumbUrl = json.mediaFile.thumbnailUrl || (json.mediaFile.id ? `${BASE_URL}/api/media/${json.mediaFile.id}?variant=thumbnail` : url);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      return {
        url: url || '',
        thumbnailUrl: thumbUrl || '',
        id: json.mediaFile.id,
        originalName: file.name,
        size: finalFile.size,
        ext,
      };
    }
    return null;
  } catch (err) {
    console.warn('[uploadMediaFromApp Error]', err);
    return null;
  }
}

/** Cria novo estudo ou devocional a partir do App com autorização de Admin */
export async function createStudyFromApp(
  payload: any,
  adminPhone?: string,
  adminIdentifier?: string
): Promise<ApiResponse<Study>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (adminPhone) headers['X-App-Admin-Phone'] = adminPhone;
  if (adminIdentifier) headers['X-App-Admin-User'] = adminIdentifier;

  const res = await fetch(`${BASE_URL}/api/estudos`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<ApiResponse<Study>>;
}

