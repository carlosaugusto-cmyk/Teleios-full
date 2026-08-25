import { dbStore } from '../../data/mockStore.ts';
import { whastmeoClient } from '../../modules/whatsapp/whastmeo.client.ts';
import { env } from '../../config/env.ts';

export class SchedulerCronService {
  private cronInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private defaultRecipient: string;

  constructor() {
    this.defaultRecipient = env.WHASTMEO_DEFAULT_RECIPIENT || '5511999998888';
    this.initCronScheduler();
  }

  /**
   * Inicializa o motor de agendamento que verifica a cada minuto se há disparos programados para o horário atual
   */
  private initCronScheduler() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[CronScheduler] Motor Cron inicializado. Horários programados ativos: 12:00 e 18:00 diariamente.');

    // Checagem periódica a cada 60s
    this.cronInterval = setInterval(() => {
      this.checkAndDispatchScheduledStudies();
    }, 60000);
  }

  /**
   * Executa a varredura no banco/store para disparar os estudos pendentes
   */
  async checkAndDispatchScheduledStudies(): Promise<{ dispatchedCount: number; results: any[] }> {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    console.log(`[CronScheduler] Varredura periódica: ${now.toLocaleTimeString()}`);

    // Filtra estudos pendentes
    const pendingStudies = dbStore.studies.filter((study) => {
      if (study.sentToWhatsapp) return false;
      if (!study.summary) return false;

      if (study.scheduledAt) {
        const sched = new Date(study.scheduledAt);
        // Se a data/hora de agendamento já passou ou é agora
        return sched.getTime() <= now.getTime() + 60000;
      }

      // Se não tiver data específica, dispara se for 12:00 ou 18:00
      return (currentHour === 12 || currentHour === 18) && currentMinute === 0;
    });

    const results = [];

    for (const study of pendingStudies) {
      const mediaFile = dbStore.files.find((f) => f.id === study.fileId);
      const title = mediaFile?.originalName || 'Estudo Técnico do Dia';

      try {
        dbStore.addLog(
          'info',
          `Disparando Estudo [${title}] para WhatsApp (${this.defaultRecipient}) via Whastmeo VPS...`,
          'CronScheduler'
        );

        const dispatchResult = await whastmeoClient.sendStudySummary(
          this.defaultRecipient,
          title,
          study.summary || '',
          study.aiImagePrompt || '',
          study.generatedImgUrl || undefined
        );

        study.sentToWhatsapp = true;
        study.sentAt = new Date().toISOString();
        study.whatsappMessageId = dispatchResult.messageId;

        dbStore.addLog(
          'success',
          `Mensagem entregue com sucesso via Whastmeo VPS! MessageID: ${dispatchResult.messageId}`,
          'CronScheduler'
        );

        results.push({
          studyId: study.id,
          success: true,
          messageId: dispatchResult.messageId,
        });
      } catch (err: any) {
        dbStore.addLog('error', `Falha ao disparar estudo ${study.id}: ${err.message}`, 'CronScheduler');
        results.push({
          studyId: study.id,
          success: false,
          error: err.message,
        });
      }
    }

    return {
      dispatchedCount: results.length,
      results,
    };
  }

  /**
   * Força a execução manual imediata de um disparo ou de todos os estudos pendentes
   */
  async triggerManualDispatch(studyId?: string, customRecipient?: string): Promise<{ success: boolean; message: string; details?: any }> {
    const recipient = customRecipient || this.defaultRecipient;

    if (studyId) {
      const study = dbStore.studies.find((s) => s.id === studyId);
      if (!study) {
        return { success: false, message: `Estudo não encontrado: ${studyId}` };
      }
      const mediaFile = dbStore.files.find((f) => f.id === study.fileId);
      const title = mediaFile?.originalName || 'Estudo Técnico AutoHub';

      dbStore.addLog('info', `Disparo Manual forçado para ${recipient} (Estudo: ${title})`, 'WhatsApp');

      const result = await whastmeoClient.sendStudySummary(
        recipient,
        title,
        study.summary || 'Resumo em processamento...',
        study.aiImagePrompt || 'Prompt conceitual',
        study.generatedImgUrl || undefined
      );

      study.sentToWhatsapp = true;
      study.sentAt = new Date().toISOString();
      study.whatsappMessageId = result.messageId;

      dbStore.addLog('success', `Disparo manual concluído! ID: ${result.messageId}`, 'WhatsApp');

      return {
        success: true,
        message: `Estudo disparado com sucesso para ${recipient}`,
        details: result,
      };
    }

    // Dispara todos pendentes
    const batchResult = await this.checkAndDispatchScheduledStudies();
    return {
      success: true,
      message: `${batchResult.dispatchedCount} estudos disparados pelo scheduler`,
      details: batchResult,
    };
  }

  getSchedulerInfo() {
    const now = new Date();
    const today12 = new Date();
    today12.setHours(12, 0, 0, 0);
    const today18 = new Date();
    today18.setHours(18, 0, 0, 0);

    const nextRuns: string[] = [];
    if (now < today12) {
      nextRuns.push('Hoje às 12:00');
      nextRuns.push('Hoje às 18:00');
    } else if (now < today18) {
      nextRuns.push('Hoje às 18:00');
      nextRuns.push('Amanhã às 12:00');
    } else {
      nextRuns.push('Amanhã às 12:00');
      nextRuns.push('Amanhã às 18:00');
    }

    return {
      active: true,
      cronSchedule: '0 12,18 * * * (12:00 e 18:00 diariamente)',
      nextRuns,
      defaultRecipient: this.defaultRecipient,
    };
  }
}

export const schedulerCronService = new SchedulerCronService();
