export interface CodeFile {
  name: string;
  path: string;
  category: 'Prisma DB' | 'Config' | 'Integrations' | 'Queues & Cron' | 'REST API';
  description: string;
  code: string;
}

export const CODE_SNIPPETS: CodeFile[] = [
  {
    name: 'schema.prisma',
    path: 'prisma/schema.prisma',
    category: 'Prisma DB',
    description: 'Definição do banco PostgreSQL com Enums, MediaFile, Study e VideoMetadata.',
    code: `// Prisma Schema para AutoHub Media & AI Pipeline
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ContentCategory {
  ESTUDO
  GALERIA
  VIDEO
  PROJETO
  APOIO
}

enum ProcessingStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model MediaFile {
  id               String           @id @default(uuid())
  originalName     String
  mimeType         String
  size             Int
  category         ContentCategory  @default(ESTUDO)
  driveFileId      String?          @unique
  driveWebViewLink String?
  driveFolderPath  String?
  youtubeVideoId   String?
  status           ProcessingStatus @default(PENDING)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  study            Study?
  videoMetadata    VideoMetadata?

  @@index([category])
  @@index([status])
  @@map("media_files")
}

model Study {
  id               String    @id @default(uuid())
  fileId           String    @unique
  rawContent       String    @db.Text
  summary          String?   @db.Text
  aiImagePrompt    String?   @db.Text
  generatedImgUrl  String?
  scheduledAt      DateTime?
  sentToWhatsapp   Boolean   @default(false)
  sentAt           DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  mediaFile        MediaFile @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@index([scheduledAt])
  @@index([sentToWhatsapp])
  @@map("studies")
}

model VideoMetadata {
  id          String    @id @default(uuid())
  fileId      String    @unique
  title       String
  description String    @db.Text
  tags        String[]  @default([])
  scheduledAt DateTime?
  published   Boolean   @default(false)
  publishedAt DateTime?
  youtubeUrl  String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  mediaFile   MediaFile @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@map("video_metadata")
}`,
  },
  {
    name: 'env.ts',
    path: 'src/config/env.ts',
    category: 'Config',
    description: 'Validação e tipagem de variáveis de ambiente com dotenv.',
    code: `import dotenv from 'dotenv';
dotenv.config();

export interface EnvironmentConfig {
  DATABASE_URL: string;
  REDIS_URL: string;
  GEMINI_API_KEY: string;
  GOOGLE_SERVICE_ACCOUNT_KEY?: string;
  WHASTMEO_API_URL: string;
  WHASTMEO_TOKEN: string;
  YOUTUBE_CLIENT_ID?: string;
  YOUTUBE_CLIENT_SECRET?: string;
  PORT: number;
}

export function validateAndLoadEnv(): EnvironmentConfig {
  return {
    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    WHASTMEO_API_URL: process.env.WHASTMEO_API_URL || 'http://localhost:8080',
    WHASTMEO_TOKEN: process.env.WHASTMEO_TOKEN || '',
    YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
    PORT: Number(process.env.PORT) || 3000,
  };
}

export const env = validateAndLoadEnv();`,
  },
  {
    name: 'drive.service.ts',
    path: 'src/modules/drive/drive.service.ts',
    category: 'Integrations',
    description: 'Criação da estrutura hierárquica /Ano/Mês/Categoria e upload no Google Drive.',
    code: `import { ContentCategory } from '../../types';

export class DriveService {
  async ensureFolderStructure(
    year: number | string = new Date().getFullYear(),
    month: number | string = String(new Date().getMonth() + 1).padStart(2, '0'),
    category: ContentCategory | string = ContentCategory.ESTUDO
  ) {
    const formattedMonth = String(month).padStart(2, '0');
    const folderPath = \`/\${year}/\${formattedMonth}/\${category}\`;
    const folderId = \`drive_folder_\${year}_\${formattedMonth}_\${category.toLowerCase()}\`;
    return { folderId, folderPath };
  }

  async uploadFileToDrive(fileBuffer: Buffer, fileName: string, mimeType: string, category: ContentCategory) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const { folderPath } = await this.ensureFolderStructure(year, month, category);

    const fileUniqueId = \`drive_\${Date.now()}_\${Math.random().toString(36).substring(2, 9)}\`;
    const webViewLink = \`https://drive.google.com/file/d/\${fileUniqueId}/view?usp=sharing\`;

    return {
      driveFileId: fileUniqueId,
      webViewLink,
      folderPath,
      uploadedAt: now.toISOString(),
    };
  }
}
export const driveService = new DriveService();`,
  },
  {
    name: 'gemini.service.ts',
    path: 'src/modules/ai/gemini.service.ts',
    category: 'Integrations',
    description: 'Síntese em português e prompt visual Midjourney/Imagen com @google/genai.',
    code: `import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../../config/env';

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }

  async processStudyContent(textContent: string) {
    const prompt = \`Analise o estudo técnico a seguir:
\"\"\"
\${textContent.slice(0, 8000)}
\"\"\"
Gere:
1. Resumo Executivo em Português (Brasil).
2. Prompt Visual descritivo em Inglês (Midjourney / Imagen style).
3. Título sugerido e pontos-chave.\`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedTitle: { type: Type.STRING },
            summary: { type: Type.STRING },
            aiImagePrompt: { type: Type.STRING },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['suggestedTitle', 'summary', 'aiImagePrompt', 'keyPoints'],
        },
      },
    });

    return JSON.parse(response.text.trim());
  }
}
export const geminiService = new GeminiService();`,
  },
  {
    name: 'whastmeo.client.ts',
    path: 'src/modules/whatsapp/whastmeo.client.ts',
    category: 'Integrations',
    description: 'Cliente HTTP para a API Whastmeo na VPS com envio de texto e mídias.',
    code: `import { env } from '../../config/env';

export class WhastmeoClient {
  private apiUrl = env.WHASTMEO_API_URL;
  private token = env.WHASTMEO_TOKEN;

  async sendTextMessage(to: string, text: string) {
    const cleanTo = to.replace(/\\D/g, '');
    const res = await fetch(\`\${this.apiUrl}/api/messages/send-text\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${this.token}\`,
      },
      body: JSON.stringify({ number: cleanTo, message: text }),
    });
    return res.json();
  }

  async sendMediaMessage(to: string, mediaUrl: string, caption?: string) {
    const cleanTo = to.replace(/\\D/g, '');
    const res = await fetch(\`\${this.apiUrl}/api/messages/send-media\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${this.token}\`,
      },
      body: JSON.stringify({ number: cleanTo, mediaUrl, caption }),
    });
    return res.json();
  }

  async sendStudySummary(to: string, title: string, summary: string, visualPrompt: string, mediaUrl?: string) {
    const formatted = \`📚 *RESUMO DO DIA - AUTOHUB AI*\\n\\n📌 *\${title.toUpperCase()}*\\n\\n\${summary}\\n\\n🎨 *PROMPT VISUAL GERADO:*\\n_\${visualPrompt}_\\n\\n⏱️ _Enviado via AutoHub Scheduler_\`;
    if (mediaUrl) return this.sendMediaMessage(to, mediaUrl, formatted);
    return this.sendTextMessage(to, formatted);
  }
}
export const whastmeoClient = new WhastmeoClient();`,
  },
  {
    name: 'youtube.service.ts',
    path: 'src/modules/youtube/youtube.service.ts',
    category: 'Integrations',
    description: 'Upload de vídeos e gerenciamento de metadados na YouTube API v3.',
    code: `export class YouTubeService {
  async uploadVideoToYouTube(videoBuffer: Buffer, title: string, description: string, privacyStatus = 'unlisted') {
    // google.youtube({ version: 'v3', auth }).videos.insert({ ... })
    const youtubeVideoId = \`yt_\${Date.now().toString(36)}\`;
    return {
      youtubeVideoId,
      youtubeUrl: \`https://www.youtube.com/watch?v=\${youtubeVideoId}\`,
      embedUrl: \`https://www.youtube.com/embed/\${youtubeVideoId}\`,
      title,
      privacyStatus,
      publishedAt: new Date().toISOString(),
    };
  }
}
export const youtubeService = new YouTubeService();`,
  },
  {
    name: 'study.worker.ts',
    path: 'src/queues/workers/study.worker.ts',
    category: 'Queues & Cron',
    description: 'Worker BullMQ para processamento de estudos com Gemini e cálculo de horário 12h/18h.',
    code: `import { geminiService } from '../../modules/ai/gemini.service';
import { prisma } from '../../lib/prisma';

export async function processStudyJob(job: { data: { studyId: string; fileId: string; rawText: string } }) {
  const { studyId, fileId, rawText } = job.data;
  
  // 1. Processa com Gemini
  const aiResult = await geminiService.processStudyContent(rawText);

  // 2. Calcula horário padrão (12:00 ou 18:00)
  const now = new Date();
  const scheduledDate = new Date();
  if (now.getHours() < 12) {
    scheduledDate.setHours(12, 0, 0, 0);
  } else if (now.getHours() < 18) {
    scheduledDate.setHours(18, 0, 0, 0);
  } else {
    scheduledDate.setDate(scheduledDate.getDate() + 1);
    scheduledDate.setHours(12, 0, 0, 0);
  }

  // 3. Atualiza no banco
  await prisma.study.update({
    where: { id: studyId },
    data: {
      summary: aiResult.summary,
      aiImagePrompt: aiResult.aiImagePrompt,
      scheduledAt: scheduledDate,
    },
  });
}`,
  },
  {
    name: 'cron.jobs.ts',
    path: 'src/queues/scheduler/cron.jobs.ts',
    category: 'Queues & Cron',
    description: 'CronJob diário às 12:00 e 18:00 para envio automático ao WhatsApp via Whastmeo.',
    code: `import cron from 'node-cron';
import { prisma } from '../../lib/prisma';
import { whastmeoClient } from '../../modules/whatsapp/whastmeo.client';

export function setupCronJobs() {
  // Executa diariamente às 12:00 e 18:00
  cron.schedule('0 12,18 * * *', async () => {
    console.log('[Cron] Executando disparo diário agendado para o WhatsApp...');
    
    const pendingStudies = await prisma.study.findMany({
      where: {
        sentToWhatsapp: false,
        summary: { not: null },
        scheduledAt: { lte: new Date() },
      },
      include: { mediaFile: true },
    });

    for (const study of pendingStudies) {
      await whastmeoClient.sendStudySummary(
        process.env.WHASTMEO_DEFAULT_RECIPIENT || '5511999998888',
        study.mediaFile.originalName,
        study.summary!,
        study.aiImagePrompt || '',
        study.generatedImgUrl || undefined
      );

      await prisma.study.update({
        where: { id: study.id },
        data: {
          sentToWhatsapp: true,
          sentAt: new Date(),
        },
      });
    }
  });
}`,
  },
  {
    name: 'ingest.controller.ts',
    path: 'src/modules/ingest/ingest.controller.ts',
    category: 'REST API',
    description: 'Controller /api/upload com Multer, Google Drive, Prisma e BullMQ.',
    code: `import { Request, Response } from 'express';
import { driveService } from '../drive/drive.service';
import { prisma } from '../../lib/prisma';
import { studyQueue } from '../../queues/queue.config';

export async function handleIngestUpload(req: Request, res: Response) {
  const { category, textContent, fileName: rawName } = req.body;
  const file = req.file;

  const fileName = file?.originalname || rawName || 'upload.txt';
  const mimeType = file?.mimetype || 'text/plain';

  // 1. Google Drive Hierarchy /Ano/Mês/Categoria
  const driveResult = await driveService.uploadFileToDrive(file?.buffer || Buffer.from(textContent), fileName, mimeType, category);

  // 2. Prisma Database Insert
  const mediaFile = await prisma.mediaFile.create({
    data: {
      originalName: fileName,
      mimeType,
      size: file?.size || (textContent ? textContent.length : 1024),
      category,
      driveFileId: driveResult.driveFileId,
      driveWebViewLink: driveResult.webViewLink,
      driveFolderPath: driveResult.folderPath,
      status: 'PENDING',
    },
  });

  // 3. Queue Dispatch
  if (category === 'ESTUDO') {
    const study = await prisma.study.create({
      data: {
        fileId: mediaFile.id,
        rawContent: textContent || file?.buffer.toString('utf-8') || '',
      },
    });

    await studyQueue.add('process-study', {
      studyId: study.id,
      fileId: mediaFile.id,
      rawText: study.rawContent,
    });
  }

  return res.status(201).json({ success: true, mediaFile });
}`,
  },
];
