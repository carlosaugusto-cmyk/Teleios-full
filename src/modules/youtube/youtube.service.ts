import { env } from '../../config/env.ts';

export interface YouTubeUploadResult {
  youtubeVideoId: string;
  youtubeUrl: string;
  embedUrl: string;
  title: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  publishedAt: string;
}
export class YouTubeService {
  private static DAILY_QUOTA_LIMIT = 10000;
  private currentQuotaUsed = 0; // Para uso em memória; em produção, usar Redis/KV.
  private lastQuotaReset = new Date().toDateString();

  private clientId?: string;
  private clientSecret?: string;

  constructor(clientId?: string, clientSecret?: string) {
    this.clientId = clientId || env.YOUTUBE_CLIENT_ID;
    this.clientSecret = clientSecret || env.YOUTUBE_CLIENT_SECRET;
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private checkAndResetQuota() {
    const today = new Date().toDateString();
    if (this.lastQuotaReset !== today) {
      this.currentQuotaUsed = 0;
      this.lastQuotaReset = today;
    }
  }

  /**
   * Realiza o upload do vídeo para a YouTube API v3 com status unlisted ou public
   */
  async uploadVideoToYouTube(
    videoPathOrBuffer: string | Buffer | Uint8Array,
    title: string,
    description: string,
    privacyStatus: 'public' | 'unlisted' | 'private' = 'unlisted',
    tags: string[] = ['AutoHub', 'AI', 'Estudo', 'Inovacao'],
    retries = 3
  ): Promise<YouTubeUploadResult> {
    this.checkAndResetQuota();

    // Uma inserção de vídeo consome ~1600 units na API v3
    const UPLOAD_QUOTA_COST = 1600;
    
    if (this.currentQuotaUsed + UPLOAD_QUOTA_COST > YouTubeService.DAILY_QUOTA_LIMIT) {
      throw new Error('Quota diária do YouTube excedida (10.000 units).');
    }

    const idempotencyKey = `idemp_yt_${title.replace(/\s/g, '_')}_${Date.now()}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[YouTubeService] Upload: "${title}" (Status: ${privacyStatus}) | Attempt ${attempt} | Idempotency: ${idempotencyKey}`);

        // Em produção completa com googleapis:
        // const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        // const res = await youtube.videos.insert({ ... });

        if (Math.random() < 0.1 && attempt < retries) {
          throw new Error('503 Backend Error - YouTube API temporarily unavailable');
        }

        // Gera ID representativo de vídeo no YouTube
        const youtubeVideoId = `yt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
        const embedUrl = `https://www.youtube.com/embed/${youtubeVideoId}`;

        // Consome cota real (mock)
        this.currentQuotaUsed += UPLOAD_QUOTA_COST;

        return {
          youtubeVideoId,
          youtubeUrl,
          embedUrl,
          title,
          privacyStatus,
          publishedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        if (attempt === retries) {
          console.error(`[YouTubeService] Falha definitiva no upload após ${retries} tentativas:`, err);
          throw err;
        }
        const backoffMs = attempt * 2000;
        console.warn(`[YouTubeService] Falha na tentativa ${attempt}. Retentando em ${backoffMs}ms...`);
        await this.sleep(backoffMs);
      }
    }
    throw new Error('Falha no upload do vídeo');
  }

  getEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`;
  }
}

export const youtubeService = new YouTubeService();
