/**
 * Configuração Centralizada de Destinos de Mídia e Conteúdo
 * 
 * Permite definir claramente:
 * - Pastas do Google Drive
 * - Canais e JIDs padrão de WhatsApp
 * - Visibilidade pública (Landing Page vs Admin)
 * - Comportamento de publicação/disparo
 */

export interface DestinationConfig {
  drive: {
    estudosFolderId: string;
    galeriaFolderId: string;
    videosFolderId: string;
    projetosFolderId: string;
    rootPath: string;
  };
  whatsapp: {
    defaultRecipient: string;
    defaultChannelId: string;
    autoDispatchEnabled: boolean;
  };
  publication: {
    showOnLandingPageByDefault: boolean;
    requireAdminApproval: boolean;
  };
}

export const DESTINATIONS: DestinationConfig = {
  drive: {
    estudosFolderId: import.meta.env.VITE_DRIVE_ESTUDOS_FOLDER_ID || '',
    galeriaFolderId: import.meta.env.VITE_DRIVE_GALERIA_FOLDER_ID || '',
    videosFolderId: import.meta.env.VITE_DRIVE_VIDEOS_FOLDER_ID || '',
    projetosFolderId: import.meta.env.VITE_DRIVE_PROJETOS_FOLDER_ID || '',
    rootPath: '/Ano/Mês/Categoria',
  },
  whatsapp: {
    defaultRecipient: import.meta.env.VITE_WA_DEFAULT_RECIPIENT || '5511999998888',
    defaultChannelId: import.meta.env.VITE_WA_DEFAULT_CHANNEL_ID || '',
    autoDispatchEnabled: false,
  },
  publication: {
    showOnLandingPageByDefault: true,
    requireAdminApproval: false,
  },
};

/**
 * Retorna dinamicamente o JID ou número do canal global ativo configurado
 */
export function getEffectiveWhatsAppRecipient(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('teleios_wa_global_channel');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.jid) return parsed.jid;
        if (parsed?.id) return parsed.id;
      }
    } catch {}
  }
  return DESTINATIONS.whatsapp.defaultChannelId || DESTINATIONS.whatsapp.defaultRecipient;
}

export function getEffectiveWhatsAppChannelId(): string {
  return getEffectiveWhatsAppRecipient();
}

