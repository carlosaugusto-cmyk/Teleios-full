/**
 * LocalStorage wrapper — schema fixo conforme especificação.
 * Chave principal: theleios:state
 * Chave de sessão: theleios:loginPromptShown
 * Chave de usuário: theleios:user
 * Chave de leitura: theleios:readItems
 */

// ─── Schema fixo (seção 8 do prompt) ─────────────────────────────────────────

export interface TheleiosState {
  lastPage: 'devocionais' | 'estudos' | 'perfil';
  lastDevocionalId: string | null;
  lastEstudoRef: { livro: string; capitulo: number } | null;
  isLoggedIn: boolean;
}

export interface TheleiosUser {
  id?: string;
  name: string;
  phone: string;
  church: string;
  photoUrl?: string | null;
  isBaptized?: boolean;
  timeAsBeliever?: string;
  inDiscipleship?: boolean;
  disciplerName?: string;
  notes?: string;
  registeredAt: string;
}

// ─── Chaves ──────────────────────────────────────────────────────────────────

const KEY_STATE = 'theleios:state';
const KEY_USER = 'theleios:user';
const KEY_LOGIN_PROMPT = 'theleios:loginPromptShown';
const KEY_READ_ITEMS = 'theleios:readItems';
const KEY_PRAYER_REQUESTS = 'theleios:prayerRequests';
const KEY_DONATIONS = 'theleios:donations';

// ─── Default state ───────────────────────────────────────────────────────────

const DEFAULT_STATE: TheleiosState = {
  lastPage: 'devocionais',
  lastDevocionalId: null,
  lastEstudoRef: null,
  isLoggedIn: false,
};

// ─── State helpers ───────────────────────────────────────────────────────────

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── State (theleios:state) ──────────────────────────────────────────────────

export function getState(): TheleiosState {
  return readJson<TheleiosState>(KEY_STATE, DEFAULT_STATE);
}

export function setState(partial: Partial<TheleiosState>): void {
  const current = getState();
  writeJson(KEY_STATE, { ...current, ...partial });
}

export function clearState(): void {
  localStorage.removeItem(KEY_STATE);
}

// ─── User (theleios:user) ────────────────────────────────────────────────────

export function getUser(): TheleiosUser | null {
  return readJson<TheleiosUser | null>(KEY_USER, null);
}

export function setUser(user: TheleiosUser): void {
  writeJson(KEY_USER, user);
  setState({ isLoggedIn: true });
}

export function clearUser(): void {
  localStorage.removeItem(KEY_USER);
  setState({ isLoggedIn: false });
}

// ─── Login prompt (1x por sessão) ────────────────────────────────────────────

export function wasLoginPromptShown(): boolean {
  return sessionStorage.getItem(KEY_LOGIN_PROMPT) === 'true';
}

export function markLoginPromptShown(): void {
  sessionStorage.setItem(KEY_LOGIN_PROMPT, 'true');
}

// ─── Read tracking ──────────────────────────────────────────────────────────

export function getReadItems(): string[] {
  return readJson<string[]>(KEY_READ_ITEMS, []);
}

export function markAsRead(id: string): void {
  const items = getReadItems();
  if (!items.includes(id)) {
    items.push(id);
    writeJson(KEY_READ_ITEMS, items);
  }
}

export function isRead(id: string): boolean {
  return getReadItems().includes(id);
}

// ─── Prayer requests local history ──────────────────────────────────────────

export interface LocalPrayerRequest {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export function getPrayerRequests(): LocalPrayerRequest[] {
  return readJson<LocalPrayerRequest[]>(KEY_PRAYER_REQUESTS, []);
}

export function addPrayerRequest(req: LocalPrayerRequest): void {
  const list = getPrayerRequests();
  list.unshift(req);
  writeJson(KEY_PRAYER_REQUESTS, list);
}

// ─── Donations local history ─────────────────────────────────────────────────

export interface LocalDonation {
  id: string;
  name: string;
  phone: string;
  amount: number;
  createdAt: string;
}

export function getDonations(): LocalDonation[] {
  return readJson<LocalDonation[]>(KEY_DONATIONS, []);
}

export function addDonation(donation: LocalDonation): void {
  const list = getDonations();
  list.unshift(donation);
  writeJson(KEY_DONATIONS, list);
}
