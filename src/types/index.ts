export enum ContentCategory {
  ESTUDO = 'ESTUDO',
  GALERIA = 'GALERIA',
  VIDEO = 'VIDEO',
  PROJETO = 'PROJETO',
  APOIO = 'APOIO',
}

// ==========================================
// AUTH & RBAC TYPES
// ==========================================

/** Módulos que podem ter permissão concedida */
export type PermissionModule =
  | 'ingest'
  | 'estudos'
  | 'galeria'
  | 'videos'
  | 'projetos'
  | 'queues'
  | 'whatsapp'
  | 'config'
  | 'code'
  | '*'; // Acesso total (Superadmin)

/** Papel do usuário no sistema */
export type UserRole = 'superadmin' | 'admin' | 'operador';

/** Usuário do sistema administrativo */
export interface User {
  id: string;
  username: string;
  /** Senha armazenada como hash PBKDF2 */
  passwordHash: string;
  role: UserRole;
  /** Lista de módulos que o usuário pode acessar */
  permissions: PermissionModule[];
  displayName: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  /** Contador de tentativas de login falhas (proteção brute-force) */
  failedLoginAttempts: number;
  /** Data/hora do bloqueio temporário de conta */
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
}

/** Sessão autenticada armazenada no cliente */
export interface AuthSession {
  token: string;
  user: Omit<User, 'passwordHash' | 'failedLoginAttempts'>;
  expiresAt: string;
}

/** Credenciais de login */
export interface LoginCredentials {
  username: string;
  password: string;
}

/** Input para criação de novo usuário (apenas Superadmin) */
export interface CreateUserInput {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  permissions: PermissionModule[];
}

/** Input para atualização de usuário */
export interface UpdateUserInput {
  displayName?: string;
  role?: UserRole;
  permissions?: PermissionModule[];
  active?: boolean;
  newPassword?: string;
}

/** Resultado de tentativa de login */
export interface LoginResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
  /** Segundos restantes se conta estiver bloqueada */
  lockedSeconds?: number;
}

export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface MediaFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: ContentCategory;
  driveFileId?: string | null;
  driveWebViewLink?: string | null;
  driveFolderPath?: string | null;
  youtubeVideoId?: string | null;
  status: ProcessingStatus;
  createdAt: string;
  updatedAt?: string;
  study?: Study | null;
  videoMetadata?: VideoMetadata | null;
}

export interface Study {
  id: string;
  fileId: string;
  title?: string;
  topic?: string;
  content?: string;
  rawContent: string;
  summary: string | null;
  aiImagePrompt: string | null;
  generatedImgUrl: string | null;
  aiImageUrl?: string | null;
  scheduledAt: string | null;
  sentToWhatsapp: boolean;
  sentAt: string | null;
  whatsappMessageId?: string | null;
  createdAt: string;
  mediaFile?: MediaFile;
  date?: string;
  driveWebViewLink?: string;
}

export interface VideoMetadata {
  id: string;
  fileId: string;
  title: string;
  description: string;
  tags?: string[];
  thumbnailUrl?: string;
  scheduledAt: string | null;
  published: boolean;
  publishedAt?: string | null;
  youtubeUrl?: string | null;
  mediaFile?: MediaFile;
  duration?: string;
  uploadDate?: string;
  youtubeVideoId?: string;
}

export interface QueueJob {
  id: string;
  name: string;
  queue: 'study-processing' | 'whatsapp-dispatch' | 'youtube-upload';
  data: any;
  status: 'active' | 'completed' | 'failed' | 'delayed' | 'waiting';
  progress: number;
  timestamp: string;
  failedReason?: string;
}

export interface SystemStatus {
  services?: {
    googleDrive?: { status: string; };
    whastmeo?: { status: string; latency?: string | number; };
    cron?: { status: string; };
    redis?: { status: string; };
  };
  gemini: { configured: boolean; model: string; status: 'online' | 'offline' };
  drive: { configured: boolean; rootFolder: string; status: 'online' | 'ready' };
  whastmeo: { configured: boolean; vpsUrl: string; status: 'online' | 'standby'; latencyMs?: number };
  youtube: { configured: boolean; status: 'ready' | 'standby' };
  scheduler: { nextRuns: string[]; active: boolean; cronSchedule: string };
  stats: {
    totalFiles: number;
    totalStudies: number;
    whatsappDispatched: number;
    youtubeVideos: number;
    driveFolders?: number;
  };
}
