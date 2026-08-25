import { geminiService } from '../../modules/ai/gemini.service.ts';
import { dbStore } from '../../data/mockStore.ts';
import { queueManager } from '../queue.config.ts';
import { ProcessingStatus } from '../../types/index.ts';

export interface StudyJobPayload {
  studyId: string;
  fileId: string;
  rawText: string;
  preferredScheduleTime?: string; // '12:00' | '18:00' | custom ISO
}

export class StudyWorker {
  /**
   * Executa o processamento do estudo pelo Gemini de forma assíncrona
   */
  async process(payload: StudyJobPayload, jobId?: string): Promise<void> {
    console.log(`[StudyWorker] Iniciando processamento do estudo ID: ${payload.studyId}`);
    if (jobId) queueManager.updateJobStatus(jobId, 'active', 20);

    const study = dbStore.studies.find((s) => s.id === payload.studyId);
    const mediaFile = dbStore.files.find((f) => f.id === payload.fileId);

    if (!study || !mediaFile) {
      const errorMsg = `Estudo ou MediaFile não encontrado para ID: ${payload.studyId}`;
      console.error(`[StudyWorker] ${errorMsg}`);
      if (jobId) queueManager.updateJobStatus(jobId, 'failed', 0, errorMsg);
      dbStore.addLog('error', errorMsg, 'StudyWorker');
      return;
    }

    try {
      mediaFile.status = ProcessingStatus.PROCESSING;
      dbStore.addLog('info', `Gemini 3.7 Flash sintetizando estudo: "${mediaFile.originalName}"`, 'GeminiWorker');

      if (jobId) queueManager.updateJobStatus(jobId, 'active', 50);

      // Chamada real ao Gemini SDK
      const aiResult = await geminiService.processStudyContent(payload.rawText);

      // Calcula o próximo horário padrão de agendamento (12:00 ou 18:00)
      const now = new Date();
      let scheduledDate = new Date();
      const currentHour = now.getHours();

      if (payload.preferredScheduleTime) {
        if (payload.preferredScheduleTime.includes('T')) {
          scheduledDate = new Date(payload.preferredScheduleTime);
        } else if (payload.preferredScheduleTime === '12:00') {
          scheduledDate.setHours(12, 0, 0, 0);
          if (currentHour >= 12) scheduledDate.setDate(scheduledDate.getDate() + 1);
        } else if (payload.preferredScheduleTime === '18:00') {
          scheduledDate.setHours(18, 0, 0, 0);
          if (currentHour >= 18) scheduledDate.setDate(scheduledDate.getDate() + 1);
        }
      } else {
        // Padrão: se antes das 12h, agenda para 12h hoje; se antes das 18h, agenda para 18h hoje; senão 12h amanhã
        if (currentHour < 12) {
          scheduledDate.setHours(12, 0, 0, 0);
        } else if (currentHour < 18) {
          scheduledDate.setHours(18, 0, 0, 0);
        } else {
          scheduledDate.setDate(scheduledDate.getDate() + 1);
          scheduledDate.setHours(12, 0, 0, 0);
        }
      }

      study.summary = aiResult.summary;
      study.aiImagePrompt = aiResult.aiImagePrompt;
      study.scheduledAt = scheduledDate.toISOString();
      study.generatedImgUrl = `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80`;

      mediaFile.status = ProcessingStatus.COMPLETED;

      if (jobId) queueManager.updateJobStatus(jobId, 'completed', 100);
      dbStore.addLog(
        'success',
        `Estudo [${mediaFile.originalName}] processado com sucesso! Agendado para WhatsApp às ${scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        'StudyWorker'
      );
    } catch (err: any) {
      console.error('[StudyWorker] Falha no processamento:', err);
      mediaFile.status = ProcessingStatus.FAILED;
      if (jobId) queueManager.updateJobStatus(jobId, 'failed', 0, err.message);
      dbStore.addLog('error', `Falha ao processar estudo: ${err.message}`, 'StudyWorker');
    }
  }
}

export const studyWorker = new StudyWorker();
