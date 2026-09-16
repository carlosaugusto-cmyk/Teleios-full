/**
 * Auth — Fase 1 apenas.
 * Cadastro simples: nome, telefone, igreja/congregação.
 * Sem senha. Dados salvos em localStorage.
 * Fase 2 (Firebase/Google) NÃO implementada aqui.
 */

import { getUser, setUser, clearUser, getState, type TheleiosUser } from './storage';
import {
  submitPedidoOracao,
  saveUserProfile,
  fetchUserProfile,
  registerAppUser,
  loginAppUser,
  type UserProfile,
} from './api';

export interface RegisterData {
  name: string;
  username?: string;
  email?: string;
  password?: string;
  phone: string;
  church: string;
  photoUrl?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  ministry?: string | null;
  city?: string;
  state?: string;
}

export interface UserProfileData {
  id?: string;
  name?: string;
  username?: string | null;
  email?: string | null;
  password?: string;
  phone?: string;
  church?: string;
  birthDate?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  ministry?: string | null;
  city?: string;
  state?: string;
  photoUrl?: string | null;
  isBaptized?: boolean;
  timeAsBeliever?: string;
  inDiscipleship?: boolean;
  disciplerName?: string;
  notes?: string;
}

/** Cadastra o usuário com email, username, senha e dados ministeriais */
export async function register(data: RegisterData): Promise<{ success: boolean; user?: TheleiosUser; error?: string }> {
  try {
    const res = await registerAppUser({
      name: data.name.trim(),
      username: data.username ? data.username.trim().replace(/^@/, '').toLowerCase() : undefined,
      email: data.email ? data.email.trim().toLowerCase() : undefined,
      password: data.password ? data.password.trim() : undefined,
      phone: data.phone.trim(),
      church: data.church.trim(),
      photoUrl: data.photoUrl || null,
      birthDate: data.birthDate || null,
      gender: data.gender || null,
      maritalStatus: data.maritalStatus || null,
      ministry: data.ministry || null,
      city: data.city ? data.city.trim() : undefined,
      state: data.state ? data.state.trim() : undefined,
    });

    if (!res.success) {
      return { success: false, error: res.error || 'Erro ao realizar cadastro.' };
    }

    const backendUser = res.data || (res as any).user;
    const user: TheleiosUser = {
      id: backendUser?.id,
      name: backendUser?.name || data.name.trim(),
      username: backendUser?.username || data.username?.trim().replace(/^@/, '').toLowerCase() || null,
      email: backendUser?.email || data.email?.trim().toLowerCase() || null,
      phone: backendUser?.phone || data.phone.trim(),
      church: backendUser?.church ?? data.church.trim(),
      photoUrl: backendUser?.photoUrl ?? (data.photoUrl || null),
      birthDate: backendUser?.birthDate || data.birthDate || null,
      gender: backendUser?.gender || data.gender || null,
      maritalStatus: backendUser?.maritalStatus || data.maritalStatus || null,
      ministry: backendUser?.ministry || data.ministry || null,
      city: backendUser?.city || data.city || '',
      state: backendUser?.state || data.state || '',
      isBaptized: backendUser?.isBaptized ?? false,
      timeAsBeliever: backendUser?.timeAsBeliever ?? '',
      inDiscipleship: backendUser?.inDiscipleship ?? false,
      disciplerName: backendUser?.disciplerName ?? '',
      notes: backendUser?.notes ?? '',
      role: backendUser?.role || 'user',
      isAdmin: Boolean(backendUser?.isAdmin || backendUser?.role === 'admin'),
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

    return { success: true, user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro de conexão com o servidor.' };
  }
}

/** Realiza login por E-mail, Nome de Usuário ou Telefone + Senha */
export async function loginWithCredentials(
  identifier: string,
  password?: string
): Promise<{ success: boolean; user?: TheleiosUser; error?: string }> {
  try {
    const res = await loginAppUser(identifier, password);
    if (!res.success || (!res.data && !(res as any).user)) {
      return { success: false, error: res.error || 'Credenciais inválidas.' };
    }

    const profile: UserProfile = res.data || (res as any).user;
    const user: TheleiosUser = {
      id: profile.id,
      name: profile.name,
      username: profile.username || null,
      email: profile.email || null,
      phone: profile.phone,
      church: profile.church || '',
      birthDate: profile.birthDate || null,
      gender: profile.gender || null,
      maritalStatus: profile.maritalStatus || null,
      ministry: profile.ministry || null,
      city: profile.city || '',
      state: profile.state || '',
      photoUrl: profile.photoUrl || null,
      role: profile.role || (profile.isAdmin ? 'admin' : 'user'),
      isAdmin: Boolean(profile.isAdmin || profile.role === 'admin' || profile.role === 'superadmin'),
      isBaptized: profile.isBaptized ?? false,
      timeAsBeliever: profile.timeAsBeliever ?? '',
      inDiscipleship: profile.inDiscipleship ?? false,
      disciplerName: profile.disciplerName ?? '',
      notes: profile.notes ?? '',
      registeredAt: profile.createdAt || new Date().toISOString(),
    };

    setUser(user);
    return { success: true, user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro de conexão com o servidor.' };
  }
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
    username: profile.username || null,
    email: profile.email || null,
    phone: profile.phone,
    church: profile.church || '',
    birthDate: profile.birthDate || null,
    gender: profile.gender || null,
    maritalStatus: profile.maritalStatus || null,
    ministry: profile.ministry || null,
    city: profile.city || '',
    state: profile.state || '',
    photoUrl: profile.photoUrl || null,
    role: profile.role || (profile.isAdmin ? 'admin' : 'user'),
    isAdmin: Boolean(profile.isAdmin || profile.role === 'admin' || profile.role === 'superadmin'),
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

/** Verifica se um número de telefone, username ou email já possui cadastro */
export async function checkUserExists(phoneOrIdentifier: string): Promise<UserProfile | null> {
  return fetchUserProfile(phoneOrIdentifier);
}

/** Atualiza dados cadastrais */
export function updateProfile(data: UserProfileData): TheleiosUser | null {
  const current = getUser();
  if (!current) return null;
  const updated: TheleiosUser = {
    ...current,
    name: data.name !== undefined ? data.name.trim() : current.name,
    username: data.username !== undefined ? (data.username ? data.username.trim().replace(/^@/, '').toLowerCase() : null) : current.username,
    email: data.email !== undefined ? (data.email ? data.email.trim().toLowerCase() : null) : current.email,
    phone: data.phone !== undefined ? data.phone.trim() : current.phone,
    church: data.church !== undefined ? data.church.trim() : current.church,
    birthDate: data.birthDate !== undefined ? data.birthDate : current.birthDate,
    gender: data.gender !== undefined ? data.gender : current.gender,
    maritalStatus: data.maritalStatus !== undefined ? data.maritalStatus : current.maritalStatus,
    ministry: data.ministry !== undefined ? data.ministry : current.ministry,
    city: data.city !== undefined ? data.city : current.city,
    state: data.state !== undefined ? data.state : current.state,
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
    id: updated.id,
    name: updated.name,
    username: updated.username,
    email: updated.email,
    password: data.password,
    phone: updated.phone,
    church: updated.church,
    birthDate: updated.birthDate,
    gender: updated.gender,
    maritalStatus: updated.maritalStatus,
    ministry: updated.ministry,
    city: updated.city,
    state: updated.state,
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
