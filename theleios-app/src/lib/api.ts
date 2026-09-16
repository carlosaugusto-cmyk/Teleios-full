/**
 * API wrapper — todas as chamadas ao Worker existente.
 * Não cria endpoints novos. Apenas consome os públicos mapeados.
 */

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
  phone: string;
  church?: string;
  photoUrl?: string | null;
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

// ─── Funções do Theleios-app ─────────────────────────────────────────────────

/** Lista todos os estudos/devocionais publicados (endpoint público, sem auth) */
export async function fetchEstudos(): Promise<Study[]> {
  const res = await request<Study[]>('/api/estudos');
  if (res.success && Array.isArray(res.data)) return res.data;
  return [];
}

/** Obtém um estudo/devocional por ID (endpoint público, sem auth) */
export async function fetchEstudo(id: string): Promise<Study | null> {
  const res = await request<Study>(`/api/estudos/${encodeURIComponent(id)}`);
  if (res.success && res.data) return res.data;
  return null;
}

/** Busca perfil do usuário no Cloudflare Worker pelo telefone */
export async function fetchUserProfile(phone: string): Promise<UserProfile | null> {
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) return null;
  try {
    const res = await request<UserProfile>(`/api/app/profile?phone=${encodeURIComponent(cleanPhone)}`);
    if (res.success && res.data) return res.data;
    return null;
  } catch {
    return null;
  }
}

/** Salva / atualiza perfil do usuário no Cloudflare Worker */
export async function saveUserProfile(profile: UserProfile): Promise<ApiResponse<UserProfile>> {
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
