/**
 * Auth — Fase 1 apenas.
 * Cadastro simples: nome, telefone, igreja/congregação.
 * Sem senha. Dados salvos em localStorage.
 * Fase 2 (Firebase/Google) NÃO implementada aqui.
 */

import { getUser, setUser, clearUser, getState, type TheleiosUser } from './storage';
import { submitPedidoOracao, saveUserProfile, fetchUserProfile, type UserProfile } from './api';

export interface RegisterData {
  name: string;
  phone: string;
  church: string;
  photoUrl?: string | null;
}

export interface UserProfileData {
  id?: string;
  name?: string;
  phone?: string;
  church?: string;
  photoUrl?: string | null;
  isBaptized?: boolean;
  timeAsBeliever?: string;
  inDiscipleship?: boolean;
  disciplerName?: string;
  notes?: string;
}

/** Cadastra o usuário localmente e reflete no backend */
export async function register(data: RegisterData): Promise<TheleiosUser> {
  // Sincroniza com o backend do Worker
  let backendUser: UserProfile | null = null;
  try {
    const res = await saveUserProfile({
      name: data.name.trim(),
      phone: data.phone.trim(),
      church: data.church.trim(),
      photoUrl: data.photoUrl || null,
    });
    if (res.success && res.data) {
      backendUser = res.data;
    }
  } catch (err) {
    console.warn('[Register Worker Sync Warning]', err);
  }

  const user: TheleiosUser = {
    id: backendUser?.id,
    name: backendUser?.name || data.name.trim(),
    phone: backendUser?.phone || data.phone.trim(),
    church: backendUser?.church ?? data.church.trim(),
    photoUrl: backendUser?.photoUrl ?? (data.photoUrl || null),
    isBaptized: backendUser?.isBaptized ?? false,
    timeAsBeliever: backendUser?.timeAsBeliever ?? '',
    inDiscipleship: backendUser?.inDiscipleship ?? false,
    disciplerName: backendUser?.disciplerName ?? '',
    notes: backendUser?.notes ?? '',
    registeredAt: backendUser?.createdAt || new Date().toISOString(),
  };
  setUser(user);

  // Reflete no admin existente via endpoint público de leads para compatibilidade
  const leadName = data.church.trim()
    ? `${data.name.trim()} (Igreja: ${data.church.trim()})`
    : data.name.trim();

  submitPedidoOracao({
    name: leadName,
    phone: data.phone.trim(),
  }).catch(() => {});

  return user;
}

/** Realiza login pelo telefone buscando o perfil no Cloudflare Worker */
export async function loginWithPhone(phone: string): Promise<{ success: boolean; user?: TheleiosUser; error?: string }> {
  const profile = await fetchUserProfile(phone);
  if (!profile) {
    return { success: false, error: 'Telefone não encontrado no sistema.' };
  }

  const user: TheleiosUser = {
    id: profile.id,
    name: profile.name,
    phone: profile.phone,
    church: profile.church || '',
    photoUrl: profile.photoUrl || null,
    isBaptized: profile.isBaptized ?? false,
    timeAsBeliever: profile.timeAsBeliever ?? '',
    inDiscipleship: profile.inDiscipleship ?? false,
    disciplerName: profile.disciplerName ?? '',
    notes: profile.notes ?? '',
    registeredAt: profile.createdAt || new Date().toISOString(),
  };
  setUser(user);
  return { success: true, user };
}

/** Verifica se um número de telefone já possui cadastro */
export async function checkUserExists(phone: string): Promise<UserProfile | null> {
  return fetchUserProfile(phone);
}

/** Atualiza dados cadastrais */
export function updateProfile(data: UserProfileData): TheleiosUser | null {
  const current = getUser();
  if (!current) return null;
  const updated: TheleiosUser = {
    ...current,
    name: data.name !== undefined ? data.name.trim() : current.name,
    phone: data.phone !== undefined ? data.phone.trim() : current.phone,
    church: data.church !== undefined ? data.church.trim() : current.church,
    photoUrl: data.photoUrl !== undefined ? data.photoUrl : current.photoUrl,
    isBaptized: data.isBaptized !== undefined ? data.isBaptized : current.isBaptized,
    timeAsBeliever: data.timeAsBeliever !== undefined ? data.timeAsBeliever : current.timeAsBeliever,
    inDiscipleship: data.inDiscipleship !== undefined ? data.inDiscipleship : current.inDiscipleship,
    disciplerName: data.disciplerName !== undefined ? data.disciplerName : current.disciplerName,
    notes: data.notes !== undefined ? data.notes : current.notes,
  };
  setUser(updated);

  // Sincroniza com o Worker
  saveUserProfile({
    name: updated.name,
    phone: updated.phone,
    church: updated.church,
    photoUrl: updated.photoUrl,
    isBaptized: updated.isBaptized,
    timeAsBeliever: updated.timeAsBeliever,
    inDiscipleship: updated.inDiscipleship,
    disciplerName: updated.disciplerName,
    notes: updated.notes,
  }).catch(() => {});

  return updated;
}

/** Faz logout — limpa dados locais */
export function logout(): void {
  clearUser();
}

/** Obtém usuário logado ou null */
export function getCurrentUser(): TheleiosUser | null {
  return getUser();
}

/** Checa se está logado */
export function isLoggedIn(): boolean {
  return getState().isLoggedIn && getUser() !== null;
}
