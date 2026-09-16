/**
 * security.service.ts
 * Serviço central de segurança da plataforma Teleios Admin.
 * Gerencia hash de senha, JWT, proteção contra brute-force e persistência de sessão.
 */

import { AuthSession, LoginCredentials, LoginResult, User } from '../types/index.ts';

// ==========================================
// CONFIGURAÇÕES DE SEGURANÇA
// ==========================================

const JWT_SECRET_KEY = 'teleios-admin-2026-super-secret-key-change-in-production';
const SESSION_DURATION_HOURS = 8;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// ==========================================
// HASH DE SENHA (PBKDF2 via Web Crypto API)
// ==========================================

async function pbkdf2Hash(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await (globalThis.crypto || window.crypto).subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await (globalThis.crypto || window.crypto).subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Cria hash seguro de uma senha com salt fixo baseado no username */
export async function hashPassword(password: string, username: string): Promise<string> {
  const salt = `teleios-salt-${username}-2026`;
  return pbkdf2Hash(password, salt);
}

/** Verifica se a senha fornecida corresponde ao hash armazenado */
export async function verifyPassword(
  password: string,
  username: string,
  storedHash: string
): Promise<boolean> {
  const hash = await hashPassword(password, username);
  return hash === storedHash;
}

// ==========================================
// GERAÇÃO DE HASH SIMPLES PARA BOOTSTRAP
// ==========================================

export function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return hex.repeat(8).substring(0, 64);
}

// ==========================================
// TOKEN JWT SIMPLES (Base64 + Assinatura HMAC-like)
// ==========================================

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
}

function simpleSign(payload: string): string {
  const key = JWT_SECRET_KEY;
  let hash = 0;
  const combined = payload + key;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/** Gera um token JWT-like para a sessão */
export function generateToken(userId: string, username: string, role: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const expiresAt = Date.now() + SESSION_DURATION_HOURS * 3600 * 1000;
  const payloadObj = { sub: userId, username, role, iat: Date.now(), exp: expiresAt };
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const signature = simpleSign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

/** Valida e decodifica um token. Retorna o payload ou null se inválido. */
export function validateToken(token: string): {
  sub: string;
  username: string;
  role: string;
  exp: number;
} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSignature = simpleSign(`${header}.${payload}`);
    if (signature !== expectedSignature) return null;

    const decoded = JSON.parse(base64UrlDecode(payload));
    if (decoded.exp < Date.now()) return null;

    return decoded;
  } catch {
    return null;
  }
}

// ==========================================
// PROTEÇÃO BRUTE-FORCE
// ==========================================

/** Verifica se a conta está bloqueada e por quanto tempo */
export function isAccountLocked(user: User): { locked: boolean; secondsRemaining: number } {
  if (!user.lockedUntil) return { locked: false, secondsRemaining: 0 };
  const lockedUntil = new Date(user.lockedUntil).getTime();
  const now = Date.now();
  if (now < lockedUntil) {
    return { locked: true, secondsRemaining: Math.ceil((lockedUntil - now) / 1000) };
  }
  return { locked: false, secondsRemaining: 0 };
}

/** Retorna a data de desbloqueio após exceder tentativas */
export function getLockoutExpiry(): string {
  return new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
}

export { MAX_LOGIN_ATTEMPTS, SESSION_DURATION_HOURS };

// ==========================================
// SANITIZAÇÃO DE INPUTS
// ==========================================

/** Remove caracteres perigosos de strings de input */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>'"\\]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .trim()
    .slice(0, 500);
}

/** Valida se o username atende ao padrão seguro */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  const clean = username.trim();
  if (clean.length < 3) return { valid: false, error: 'Mínimo de 3 caracteres.' };
  if (clean.length > 30) return { valid: false, error: 'Máximo de 30 caracteres.' };
  if (!/^[a-z0-9_.-]+$/.test(clean))
    return { valid: false, error: 'Apenas letras minúsculas, números, _ e -.' };
  return { valid: true };
}

/** Valida a força da senha */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 6) return { valid: false, error: 'Mínimo de 6 caracteres.' };
  if (password.length > 128) return { valid: false, error: 'Máximo de 128 caracteres.' };
  return { valid: true };
}

// ==========================================
// SESSÃO LOCAL (localStorage)
// ==========================================

const SESSION_STORAGE_KEY = 'teleios_auth_session';

/** Salva a sessão autenticada no localStorage */
export function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

/** Carrega a sessão do localStorage e valida a expiração */
export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/** Remove a sessão do localStorage */
export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

// ==========================================
// VERIFICAÇÃO DE PERMISSÕES
// ==========================================

/** Verifica se o usuário possui permissão para acessar um módulo específico */
export function hasPermission(
  userPermissions: string[],
  module: string
): boolean {
  return userPermissions.includes('*') || userPermissions.includes(module);
}
