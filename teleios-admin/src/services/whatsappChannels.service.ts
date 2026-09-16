import { apiFetch } from './api.service.ts';
import { DESTINATIONS } from '../config/destinations.ts';

export type WaDestinationType = 'newsletter' | 'channel' | 'group' | 'community' | 'contact' | 'individual';

export interface WaDestination {
  id: string;
  name: string;
  jid: string;
  type: WaDestinationType;
  selected?: boolean;
  isGlobal?: boolean;
}

export const CHANNELS_STORAGE_KEY = 'teleios_wa_channels';
export const GLOBAL_CHANNEL_STORAGE_KEY = 'teleios_wa_global_channel';
export const GLOBAL_CHANNEL_CHANGE_EVENT = 'teleios:global-wa-channel-updated';

/** Carrega os canais salvos localmente (excluindo qualquer resquício de número padrão) */
export function getSavedChannels(): WaDestination[] {
  try {
    const saved = localStorage.getItem(CHANNELS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as WaDestination[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const globalChan = getStoredGlobalChannelOnly();
        return parsed
          .filter((item) => item.id !== 'direct_default' && !(item.name || '').toLowerCase().includes('número padrão'))
          .map((item) => {
            const jid = item.jid || item.id;
            return {
              ...item,
              id: jid,
              jid: jid,
              isGlobal: globalChan ? (globalChan.jid === jid || globalChan.id === jid) : !!item.isGlobal,
            };
          });
      }
    }
  } catch {}
  return [];
}

/** Lê apenas o objeto bruto salvo na chave global sem recursão */
function getStoredGlobalChannelOnly(): WaDestination | null {
  try {
    const raw = localStorage.getItem(GLOBAL_CHANNEL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.jid || parsed.id)) {
        const jid = parsed.jid || parsed.id;
        return {
          id: jid,
          name: parsed.name || 'Canal Principal',
          jid: jid,
          type: parsed.type || 'group',
          isGlobal: true,
        };
      }
    }
  } catch {}
  return null;
}

/** Obtém o canal global atual de WhatsApp com fallback em cascata */
export function getGlobalWhatsAppChannel(): WaDestination | null {
  // 1. Canal explicitamente gravado na chave global
  const stored = getStoredGlobalChannelOnly();
  if (stored) return stored;

  // 2. Primeiro canal da lista marcado como isGlobal
  const saved = getSavedChannels();
  const markedGlobal = saved.find((c) => c.isGlobal);
  if (markedGlobal) {
    try {
      localStorage.setItem(GLOBAL_CHANNEL_STORAGE_KEY, JSON.stringify(markedGlobal));
    } catch {}
    return markedGlobal;
  }

  // 3. Primeiro canal ativo da lista
  if (saved.length > 0) {
    const first = { ...saved[0], isGlobal: true };
    try {
      localStorage.setItem(GLOBAL_CHANNEL_STORAGE_KEY, JSON.stringify(first));
    } catch {}
    return first;
  }

  // 4. Fallback com base em destinos configurados por ambiente
  if (DESTINATIONS.whatsapp.defaultChannelId) {
    const fallback: WaDestination = {
      id: DESTINATIONS.whatsapp.defaultChannelId,
      name: 'Canal Padrão Configurado',
      jid: DESTINATIONS.whatsapp.defaultChannelId,
      type: 'group',
      isGlobal: true,
    };
    return fallback;
  }

  return null;
}

/** Define e persiste o canal global de WhatsApp em toda a aplicação */
export async function setGlobalWhatsAppChannel(channelOrJid: WaDestination | string): Promise<WaDestination | null> {
  const saved = getSavedChannels();
  let targetChannel: WaDestination | null = null;

  if (typeof channelOrJid === 'string') {
    const clean = channelOrJid.trim();
    targetChannel = saved.find((c) => c.jid === clean || c.id === clean) || null;
    if (!targetChannel) {
      targetChannel = {
        id: clean,
        name: clean.includes('@') ? clean.split('@')[0] : clean,
        jid: clean,
        type: clean.includes('@newsletter') ? 'newsletter' : clean.includes('@g.us') ? 'group' : 'individual',
        isGlobal: true,
      };
    }
  } else {
    targetChannel = { ...channelOrJid, isGlobal: true };
  }

  if (!targetChannel) return null;

  targetChannel.isGlobal = true;

  // 1. Salva no localStorage
  try {
    localStorage.setItem(GLOBAL_CHANNEL_STORAGE_KEY, JSON.stringify(targetChannel));
  } catch {}

  // 2. Atualiza a lista de canais locais marcando apenas ele como global
  const updatedChannels: WaDestination[] = saved.map((c) => ({
    ...c,
    isGlobal: c.jid === targetChannel?.jid || c.id === targetChannel?.id,
  }));
  if (!updatedChannels.some((c) => c.jid === targetChannel?.jid)) {
    updatedChannels.unshift({ ...targetChannel, isGlobal: true });
  }
  saveChannels(updatedChannels);

  // 3. Atualiza DESTINATIONS em memória
  if (DESTINATIONS.whatsapp) {
    DESTINATIONS.whatsapp.defaultChannelId = targetChannel.jid;
    DESTINATIONS.whatsapp.defaultRecipient = targetChannel.jid;
  }

  // 4. Sincroniza com o backend Cloudflare Worker KV / Server Node
  try {
    await apiFetch('/api/config/admin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        whatsapp: {
          defaultChannelJid: targetChannel.jid,
          defaultChannelName: targetChannel.name,
          defaultChannelType: targetChannel.type,
        },
      }),
    });
  } catch {}

  try {
    await apiFetch('/api/config/whatsapp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        defaultChannelJid: targetChannel.jid,
        defaultChannelName: targetChannel.name,
        defaultChannelType: targetChannel.type,
      }),
    });
  } catch {}

  // 5. Emite evento global para que todas as telas se atualizem em tempo real
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(GLOBAL_CHANNEL_CHANGE_EVENT, {
        detail: targetChannel,
      })
    );
  }

  return targetChannel;
}

/** Salva os canais no localStorage */
export function saveChannels(channels: WaDestination[]): void {
  const clean = channels.filter(
    (c) => c.id !== 'direct_default' && !(c.name || '').toLowerCase().includes('número padrão')
  );
  localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(clean));
}

/**
 * Busca grupos, comunidades, newsletters e contatos em tempo real.
 * 1. Tenta via Cloudflare Worker / Durable Object (/api/agent/groups ou /api/channels)
 * 2. Se falhar e estiver em ambiente local, tenta direto em http://localhost:8080/groups
 */
export async function fetchLiveWhatsAppGroups(
  customUrl?: string
): Promise<{ success: boolean; data: WaDestination[]; destinations: WaDestination[]; error?: string }> {
  // 1. Tentar primeiro através da API oficial do Worker / Durable Object (/api/agent/groups)
  try {
    const res = await apiFetch('/api/agent/groups');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const formatted: WaDestination[] = json.data
          .filter((item: any) => item.id !== 'direct_default' && !(item.name || '').toLowerCase().includes('número padrão'))
          .map((item: any) => {
            const jid = item.jid || item.whatsappJid || '';
            let type: WaDestinationType = 'group';
            if (item.type === 'newsletter' || item.type === 'channel') type = 'newsletter';
            else if (item.type === 'community') type = 'community';
            else if (item.type === 'contact') type = 'contact';
            else if (item.type === 'individual') type = 'individual';
            return {
              id: jid,
              name: item.name || 'Sem Nome',
              jid: jid,
              type,
            };
          });
        saveChannels(formatted);
        return { success: true, data: formatted, destinations: formatted };
      }
    }
  } catch {}

  // 1b. Tentar buscar de /api/channels
  try {
    const res = await apiFetch('/api/channels');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const formatted: WaDestination[] = json.data
          .filter((item: any) => item.id !== 'direct_default' && !(item.name || '').toLowerCase().includes('número padrão'))
          .map((item: any) => {
            const jid = item.jid || item.whatsappJid || '';
            let type: WaDestinationType = 'group';
            if (item.type === 'newsletter' || item.type === 'channel') type = 'newsletter';
            else if (item.type === 'community') type = 'community';
            else if (item.type === 'contact') type = 'contact';
            else if (item.type === 'individual') type = 'individual';
            return {
              id: jid,
              name: item.name || 'Sem Nome',
              jid: jid,
              type,
            };
          });
        saveChannels(formatted);
        return { success: true, data: formatted, destinations: formatted };
      }
    }
  } catch {}

  // 2. Fallback local: se customUrl ou localhost:8080 estiver acessível
  const localUrl = customUrl || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8080/groups' : null);
  if (localUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(localUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const formatted: WaDestination[] = data.data
            .filter((item: any) => item.id !== 'direct_default' && !(item.name || '').toLowerCase().includes('número padrão'))
            .map((item: any) => {
              const jid = item.jid || item.whatsappJid || '';
              let type: WaDestinationType = 'group';
              if (item.type === 'newsletter' || item.type === 'channel') type = 'newsletter';
              else if (item.type === 'community') type = 'community';
              else if (item.type === 'contact') type = 'contact';
              else if (item.type === 'individual') type = 'individual';
              return {
                id: jid,
                name: item.name || 'Sem Nome',
                jid: jid,
                type,
              };
            });
          saveChannels(formatted);
          return { success: true, data: formatted, destinations: formatted };
        }
      }
    } catch {}
  }

  // Se nenhum respondeu ainda, retorna os canais salvos em cache local
  const cached = getSavedChannels();
  if (cached.length > 0) {
    return { success: true, data: cached, destinations: cached };
  }

  return {
    success: false,
    data: [],
    destinations: [],
    error: 'Nenhum canal/grupo encontrado. Verifique se o WhatsApp Agent Go está em execução e conectado ao WhatsApp.',
  };
}

export interface SendWhatsAppPayload {
  recipient: string;
  text: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  mediaBase64?: string | null;
  customUrl?: string;
}

/**
 * Dispara uma mensagem via Cloudflare Worker / Durable Object (/api/jobs)
 * com fallback para o HTTP local caso necessário.
 */
export async function sendWhatsAppDirectMessage(
  payloadOrPhone: string | SendWhatsAppPayload,
  legacyText?: string,
  legacyImageUrl?: string | null,
  legacyAudioUrl?: string | null
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  let recipient = '';
  let text = '';
  let imageUrl: string | undefined;
  let audioUrl: string | undefined;

  if (typeof payloadOrPhone === 'object') {
    recipient = payloadOrPhone.recipient;
    text = payloadOrPhone.text;
    imageUrl = payloadOrPhone.imageUrl || undefined;
    audioUrl = payloadOrPhone.audioUrl || undefined;
  } else {
    recipient = payloadOrPhone;
    text = legacyText || '';
    imageUrl = legacyImageUrl || undefined;
    audioUrl = legacyAudioUrl || undefined;
  }

  // Resolução com canal global padrão: se não foi fornecido destinatário específico
  // ou se for o número padrão genérico '5511999998888', utiliza o canal global ativo
  const globalChan = getGlobalWhatsAppChannel();
  if ((!recipient || recipient === '5511999998888' || recipient === DESTINATIONS.whatsapp.defaultRecipient) && globalChan) {
    recipient = globalChan.jid || globalChan.id;
  }

  // 1. Enviar via Cloudflare Worker / Durable Object (/api/jobs)
  try {
    const jobPayload: any = {
      content: text,
      mediaUrl: imageUrl || audioUrl,
    };

    if (recipient && (recipient.includes('@g.us') || recipient.includes('@newsletter') || recipient.includes('@s.whatsapp.net'))) {
      jobPayload.channelId = recipient;
    } else if (recipient) {
      jobPayload.targetPhone = recipient.replace(/[^0-9]/g, '');
    } else if (globalChan) {
      jobPayload.channelId = globalChan.jid;
    }

    const res = await apiFetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobPayload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          success: true,
          messageId: data.data?.id || data.jobId,
        };
      }
    }
  } catch (e: any) {
    console.warn('[WhatsApp Service] Worker dispatch failed, trying local fallback:', e);
  }

  // 2. Fallback para localhost:8080 se estiver rodando localmente
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    try {
      const res = await fetch('http://localhost:8080/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: recipient,
          text,
          imageUrl,
          audioUrl,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          messageId: data.messageID || data.messageIDs?.[0],
        };
      }
    } catch {}
  }

  return {
    success: false,
    error: 'Falha ao despachar mensagem. Certifique-se de que o Agent Go do WhatsApp está conectado.',
  };
}
