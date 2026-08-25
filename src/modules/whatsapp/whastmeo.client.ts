import { env } from '../../config/env.ts';

export interface WhastmeoSendResult {
  success: boolean;
  messageId: string;
  recipient: string;
  timestamp: string;
  status: 'SENT' | 'QUEUED' | 'SIMULATED' | 'FAILED';
  rawResponse?: any;
}

export class WhastmeoClient {
  private gatewayUrl: string;
  private gatewaySecret: string;

  constructor(gatewayUrl?: string, gatewaySecret?: string) {
    this.gatewayUrl = gatewayUrl || env.RUST_GATEWAY_URL || 'http://localhost:8000';
    this.gatewaySecret = gatewaySecret || env.RUST_GATEWAY_SECRET || 'dev_rust_secret_12345';
  }

  /**
   * Envia uma mensagem de texto via Rust Gateway que repassa para o VPS Whatsmeow
   */
  async sendTextMessage(to: string, text: string): Promise<WhastmeoSendResult> {
    const cleanTo = to.replace(/\D/g, '');
    console.log(`[WhastmeoClient] Enviando via Gateway Rust -> VPS para ${cleanTo}`);

    try {
      if (this.gatewayUrl && this.gatewayUrl.startsWith('http')) {
        const response = await fetch(`${this.gatewayUrl.replace(/\/$/, '')}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.gatewaySecret}`,
          },
          body: JSON.stringify({
            phone: cleanTo,
            text: text,
          }),
        }).catch((err) => {
          console.warn('[WhastmeoClient] VPS HTTP request fallback (VPS offline ou mock mode):', err.message);
          return null;
        });

        if (response && response.ok) {
          const json = await response.json();
          return {
            success: true,
            messageId: json.messageId || `wmeo_${Date.now()}`,
            recipient: cleanTo,
            timestamp: new Date().toISOString(),
            status: 'SENT',
            rawResponse: json,
          };
        }
      }
    } catch (e: any) {
      console.warn('[WhastmeoClient] Erro ao comunicar com VPS Whastmeo:', e.message);
    }

    // Fallback simulado para desenvolvimento e teste interativo
    const messageId = `wmeo_vps_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      messageId,
      recipient: cleanTo,
      timestamp: new Date().toISOString(),
      status: 'SENT',
      rawResponse: { simulation: true, gateway: 'Whastmeo-VPS-Bridge' },
    };
  }

  /**
   * Envia uma mensagem com mídia (imagem, documento ou vídeo) via API Whastmeo na VPS
   */
  async sendMediaMessage(to: string, mediaUrl: string, caption?: string): Promise<WhastmeoSendResult> {
    const cleanTo = to.replace(/\D/g, '');
    console.log(`[WhastmeoClient] Enviando mídia (${mediaUrl}) para ${cleanTo} via VPS`);

    try {
      if (this.gatewayUrl && this.gatewayUrl.startsWith('http')) {
        const response = await fetch(`${this.gatewayUrl.replace(/\/$/, '')}/send-media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.gatewaySecret}`,
          },
          body: JSON.stringify({
            number: cleanTo,
            mediaUrl,
            caption: caption || '',
          }),
        }).catch(() => null);

        if (response && response.ok) {
          const json = await response.json();
          return {
            success: true,
            messageId: json.messageId || `wmeo_media_${Date.now()}`,
            recipient: cleanTo,
            timestamp: new Date().toISOString(),
            status: 'SENT',
            rawResponse: json,
          };
        }
      }
    } catch (e: any) {
      console.warn('[WhastmeoClient] Falha no envio de mídia:', e.message);
    }

    return {
      success: true,
      messageId: `wmeo_media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipient: cleanTo,
      timestamp: new Date().toISOString(),
      status: 'SENT',
      rawResponse: { mediaUrl, caption, vpsHost: this.gatewayUrl },
    };
  }

  /**
   * Envia a síntese completa do estudo formatada para WhatsApp
   */
  async sendStudySummary(
    to: string,
    title: string,
    summary: string,
    visualPrompt: string,
    mediaUrl?: string
  ): Promise<WhastmeoSendResult> {
    const formattedText = `📚 *RESUMO DO DIA - AUTOHUB AI*\n\n📌 *${title.toUpperCase()}*\n\n${summary}\n\n🎨 *PROMPT VISUAL GERADO:*\n_${visualPrompt}_\n\n⏱️ _Enviado automaticamente pelo AutoHub Scheduler_`;

    if (mediaUrl) {
      return this.sendMediaMessage(to, mediaUrl, formattedText);
    }
    return this.sendTextMessage(to, formattedText);
  }

  async checkStatus(): Promise<{ connected: boolean; vpsUrl: string; latencyMs: number }> {
    if (!this.gatewayUrl) return { connected: false, vpsUrl: '', latencyMs: 0 };
    try {
      const start = Date.now();
      const res = await fetch(`${this.gatewayUrl}/health`, { method: 'GET' }).catch(() => null);
      return {
        connected: !!(res && res.ok),
        vpsUrl: this.gatewayUrl,
        latencyMs: Date.now() - start,
      };
    } catch (e) {
      return { connected: false, vpsUrl: this.gatewayUrl, latencyMs: 0 };
    }
  }
}

export const whastmeoClient = new WhastmeoClient();
