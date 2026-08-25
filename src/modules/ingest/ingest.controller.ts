import { Request, Response } from 'express';
import { driveService } from '../drive/drive.service.ts';
import { dbStore } from '../../data/mockStore.ts';
import { ContentCategory, ProcessingStatus, MediaFile, Study, VideoMetadata } from '../../types/index.ts';
import { queueManager } from '../../queues/queue.config.ts';
import { studyWorker } from '../../queues/workers/study.worker.ts';
import { youtubeService } from '../youtube/youtube.service.ts';

export async function handleIngestUpload(req: Request, res: Response) {
  try {
    const {
      fileName: rawFileName,
      category = ContentCategory.ESTUDO,
      textContent,
      mimeType: rawMimeType,
      scheduleTime,
      videoTitle,
      videoDescription,
      fileData, // base64 or text
    } = req.body;

    const file = req.file; // Se enviado via multipart multer
    const fileName = file?.originalname || rawFileName || `upload_${Date.now()}.${category === ContentCategory.VIDEO ? 'mp4' : 'txt'}`;
    const mimeType = file?.mimetype || rawMimeType || (category === ContentCategory.ESTUDO ? 'text/plain' : 'application/octet-stream');
    const fileSize = file?.size || (fileData ? Buffer.from(fileData, 'base64').length : (textContent ? textContent.length : 1024));

    console.log(`[IngestController] Recebendo ingestão de mídia: ${fileName} [Categoria: ${category}]`);

    // 1. Upload e Organização no Google Drive (/Ano/Mês/Categoria)
    const fileBuffer = file?.buffer || (fileData ? Buffer.from(fileData, 'base64') : Buffer.from(textContent || ''));
    const driveResult = await driveService.uploadFileToDrive(fileBuffer, fileName, mimeType, category as ContentCategory);

    // 2. Catalogação no Banco de Dados
    const mediaFile: MediaFile = {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      originalName: fileName,
      mimeType,
      size: fileSize,
      category: category as ContentCategory,
      driveFileId: driveResult.driveFileId,
      driveWebViewLink: driveResult.webViewLink,
      driveFolderPath: driveResult.folderPath,
      status: ProcessingStatus.PENDING,
      createdAt: new Date().toISOString(),
    };

    dbStore.files.unshift(mediaFile);
    dbStore.addLog('success', `Arquivo catalogado e sincronizado no Google Drive: ${driveResult.folderPath}/${fileName}`, 'Ingest');

    // 3. Roteamento por Categoria
    if (category === ContentCategory.ESTUDO) {
      const contentToAnalyze = textContent || (file ? file.buffer.toString('utf-8') : `Conteúdo do arquivo ${fileName}`);
      
      const study: Study = {
        id: `study_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fileId: mediaFile.id,
        rawContent: contentToAnalyze,
        summary: null,
        aiImagePrompt: null,
        generatedImgUrl: null,
        scheduledAt: null,
        sentToWhatsapp: false,
        sentAt: null,
        createdAt: new Date().toISOString(),
        mediaFile,
      };

      mediaFile.study = study;
      dbStore.studies.unshift(study);

      // Adiciona Job na fila BullMQ
      const job = await queueManager.addJob(
        'study-processing',
        `Processar Estudo: ${fileName}`,
        { studyId: study.id, fileId: mediaFile.id, rawText: contentToAnalyze, scheduleTime }
      );

      // Executa o worker (assíncrono)
      studyWorker.process({
        studyId: study.id,
        fileId: mediaFile.id,
        rawText: contentToAnalyze,
        preferredScheduleTime: scheduleTime,
      }, job.id);

      return res.status(201).json({
        success: true,
        message: 'Estudo recebido com sucesso. Processamento de IA e agendamento iniciados.',
        mediaFile,
        study,
        jobId: job.id,
      });
    }

    if (category === ContentCategory.VIDEO) {
      const videoMeta: VideoMetadata = {
        id: `vidmeta_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fileId: mediaFile.id,
        title: videoTitle || fileName.replace(/\.[^/.]+$/, ''),
        description: videoDescription || `Upload automatizado via AutoHub para o arquivo ${fileName}.`,
        tags: ['AutoHub', 'VideoPipeline', 'AI'],
        scheduledAt: scheduleTime ? new Date(scheduleTime).toISOString() : null,
        published: false,
        youtubeUrl: null,
        mediaFile,
      };

      mediaFile.videoMetadata = videoMeta;
      dbStore.videos.unshift(videoMeta);

      const job = await queueManager.addJob(
        'youtube-upload',
        `Upload YouTube: ${videoMeta.title}`,
        { videoId: videoMeta.id, fileId: mediaFile.id }
      );

      // Upload assíncrono para o YouTube
      youtubeService.uploadVideoToYouTube(fileBuffer, videoMeta.title, videoMeta.description)
        .then((ytResult) => {
          videoMeta.youtubeUrl = ytResult.youtubeUrl;
          mediaFile.youtubeVideoId = ytResult.youtubeVideoId;
          videoMeta.published = true;
          videoMeta.publishedAt = ytResult.publishedAt;
          mediaFile.status = ProcessingStatus.COMPLETED;
          queueManager.updateJobStatus(job.id, 'completed', 100);
          dbStore.addLog('success', `Vídeo publicado com sucesso no YouTube: ${ytResult.youtubeUrl}`, 'YouTube');
        })
        .catch((err) => {
          queueManager.updateJobStatus(job.id, 'failed', 0, err.message);
          dbStore.addLog('error', `Falha no upload do YouTube: ${err.message}`, 'YouTube');
        });

      return res.status(201).json({
        success: true,
        message: 'Vídeo catalogado e enviado para processamento no YouTube.',
        mediaFile,
        videoMetadata: videoMeta,
        jobId: job.id,
      });
    }

    // Categorias GALERIA, PROJETO, APOIO
    mediaFile.status = ProcessingStatus.COMPLETED;
    return res.status(201).json({
      success: true,
      message: `Arquivo catalogado na categoria ${category} e salvo no Google Drive.`,
      mediaFile,
    });
  } catch (error: any) {
    console.error('[IngestController] Erro na ingestão:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno ao processar upload.',
    });
  }
}
