import { Request, Response } from 'express';
import { dbStore } from '../../data/mockStore.ts';
import { ContentCategory } from '../../types/index.ts';
import { geminiService } from '../ai/gemini.service.ts';
import { schedulerCronService } from '../../queues/scheduler/cron.jobs.ts';
import { whastmeoClient } from '../whatsapp/whastmeo.client.ts';
import { env } from '../../config/env.ts';

export async function getEstudos(req: Request, res: Response) {
  try {
    const studies = dbStore.studies.map((s) => {
      const mediaFile = dbStore.files.find((f) => f.id === s.fileId);
      let safeMediaFile = undefined;
      if (mediaFile) {
        const { study, videoMetadata, ...rest } = mediaFile;
        safeMediaFile = rest;
      }
      return {
        ...s,
        mediaFile: safeMediaFile,
      };
    });
    return res.json({ success: true, count: studies.length, data: studies });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function getGaleria(req: Request, res: Response) {
  try {
    const galeriaFiles = dbStore.files.filter((f) => f.category === ContentCategory.GALERIA);
    return res.json({ success: true, count: galeriaFiles.length, data: galeriaFiles });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function getVideos(req: Request, res: Response) {
  try {
    const videos = dbStore.videos.map((v) => {
      const mediaFile = dbStore.files.find((f) => f.id === v.fileId);
      let safeMediaFile = undefined;
      if (mediaFile) {
        const { study, videoMetadata, ...rest } = mediaFile;
        safeMediaFile = rest;
      }
      return {
        ...v,
        mediaFile: safeMediaFile,
      };
    });
    return res.json({ success: true, count: videos.length, data: videos });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function getProjetos(req: Request, res: Response) {
  try {
    const projetoFiles = dbStore.files.filter(
      (f) => f.category === ContentCategory.PROJETO || f.category === ContentCategory.APOIO
    );
    return res.json({ success: true, count: projetoFiles.length, data: projetoFiles });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function reprocessStudyAI(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const study = dbStore.studies.find((s) => s.id === id);
    if (!study) {
      return res.status(404).json({ success: false, error: 'Estudo não encontrado' });
    }

    dbStore.addLog('info', `Reprocessando estudo ${id} com Gemini AI Studio...`, 'Gemini');
    const aiResult = await geminiService.processStudyContent(study.rawContent);

    study.summary = aiResult.summary;
    study.aiImagePrompt = aiResult.aiImagePrompt;

    dbStore.addLog('success', `Estudo ${id} reprocessado com sucesso pelo Gemini!`, 'Gemini');
    return res.json({ success: true, study });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function dispatchStudyToWhatsapp(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { recipient } = req.body;

    const result = await schedulerCronService.triggerManualDispatch(id, recipient);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function getSystemStatus(req: Request, res: Response) {
  try {
    const schedulerInfo = schedulerCronService.getSchedulerInfo();
    const whastmeoStatus = await whastmeoClient.checkStatus();

    return res.json({
      success: true,
      data: {
        gemini: {
          configured: Boolean(env.GEMINI_API_KEY),
          model: 'gemini-3.7-flash',
          status: 'online',
        },
        drive: {
          configured: true,
          rootFolder: '/Ano/Mês/Categoria',
          status: 'online',
        },
        whastmeo: {
          configured: Boolean(env.WHASTMEO_TOKEN),
          vpsUrl: env.WHASTMEO_API_URL,
          status: whastmeoStatus.connected ? 'online' : 'standby',
          latencyMs: whastmeoStatus.latencyMs,
        },
        youtube: {
          configured: Boolean(env.YOUTUBE_CLIENT_ID || true),
          status: 'ready',
        },
        scheduler: schedulerInfo,
        stats: {
          totalFiles: dbStore.files.length,
          totalStudies: dbStore.studies.length,
          whatsappDispatched: dbStore.studies.filter((s) => s.sentToWhatsapp).length,
          youtubeVideos: dbStore.videos.length,
        },
        recentLogs: dbStore.logs.slice(0, 15),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
