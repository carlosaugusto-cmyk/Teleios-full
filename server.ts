import express, { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { handleIngestUpload } from './src/modules/ingest/ingest.controller.ts';
import {
  getEstudos,
  getGaleria,
  getVideos,
  getProjetos,
  reprocessStudyAI,
  dispatchStudyToWhatsapp,
  getSystemStatus,
} from './src/modules/content/content.controller.ts';
import { queueManager } from './src/queues/queue.config.ts';
import { schedulerCronService } from './src/queues/scheduler/cron.jobs.ts';
import { dbStore } from './src/data/mockStore.ts';
import { env } from './src/config/env.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

async function startServer() {
  const app = express();
  const PORT = env.PORT;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // --- MIDDLEWARE DE AUTENTICAÇÃO ---
  const authMiddleware = async (req: Request, res: Response, next: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Token não fornecido.' });
      }

      const token = authHeader.split(' ')[1];
      const { validateToken } = await import('./src/services/security.service.ts');
      
      const decoded = validateToken(token);
      if (!decoded) {
        return res.status(401).json({ success: false, error: 'Token inválido ou expirado.' });
      }

      const user = dbStore.findUserById(decoded.sub);
      if (!user || !user.active) {
        return res.status(401).json({ success: false, error: 'Usuário não encontrado ou desativado.' });
      }

      (req as any).user = user;
      next();
    } catch (err) {
      res.status(500).json({ success: false, error: 'Erro de autenticação.' });
    }
  };

  const requirePermission = (module: string) => {
    return (req: Request, res: Response, next: any) => {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ success: false, error: 'Não autenticado.' });
      
      const hasPerm = user.permissions.includes('*') || user.permissions.includes(module);
      if (!hasPerm) {
        return res.status(403).json({ success: false, error: 'Acesso negado ao módulo.' });
      }
      next();
    };
  };

  // --- API ROUTES ---

  // --- AUTH & USER MANAGEMENT ---
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      const result = await dbStore.authenticateUser(username, password);
      
      if (result.success && result.user) {
        const { generateToken } = await import('./src/services/security.service.ts');
        const token = generateToken(result.user.id, result.user.username, result.user.role);
        const { passwordHash: _, failedLoginAttempts: __, ...safeUser } = result.user;
        
        res.json({
          success: true,
          session: {
            token,
            user: safeUser,
            expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString()
          }
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error,
          lockedSeconds: result.lockedSeconds
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/auth/me', authMiddleware, (req: Request, res: Response) => {
    const user = (req as any).user;
    const { passwordHash: _, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  });

  // Apenas superadmin ou admin podem gerenciar usuários (idealmente apenas superadmin, mas deixamos config)
  app.get('/api/auth/users', authMiddleware, requirePermission('config'), (req: Request, res: Response) => {
    res.json({ success: true, users: dbStore.listUsers() });
  });

  app.post('/api/auth/users', authMiddleware, requirePermission('config'), async (req: Request, res: Response) => {
    try {
      // Idealmente, validar se é superadmin
      if ((req as any).user.role !== 'superadmin') {
        return res.status(403).json({ success: false, error: 'Apenas Superadmin pode criar usuários.' });
      }
      const user = await dbStore.createUser(req.body);
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.put('/api/auth/users/:id', authMiddleware, requirePermission('config'), async (req: Request, res: Response) => {
    try {
      if ((req as any).user.role !== 'superadmin' && (req as any).user.id !== req.params.id) {
        return res.status(403).json({ success: false, error: 'Sem permissão para editar este usuário.' });
      }
      const user = await dbStore.updateUser(req.params.id, req.body);
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/auth/users/:id', authMiddleware, requirePermission('config'), (req: Request, res: Response) => {
    try {
      if ((req as any).user.role !== 'superadmin') {
        return res.status(403).json({ success: false, error: 'Apenas Superadmin pode deletar usuários.' });
      }
      dbStore.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // System status & statistics (Public - required for landing page)
  app.get('/api/status', getSystemStatus);

  // Ingestão / Upload Endpoint
  app.post('/api/upload', authMiddleware, requirePermission('ingest'), upload.single('file'), handleIngestUpload);

  // Content Endpoints (GETs are public for landing page)
  app.get('/api/estudos', getEstudos);
  app.post('/api/estudos/:id/process-ai', authMiddleware, requirePermission('estudos'), reprocessStudyAI);
  app.post('/api/estudos/:id/dispatch-whatsapp', authMiddleware, requirePermission('estudos'), dispatchStudyToWhatsapp);

  app.get('/api/galeria', getGaleria);
  app.get('/api/videos', getVideos);
  app.get('/api/projetos', getProjetos);

  // Queue & Worker monitor
  app.get('/api/queues/jobs', authMiddleware, requirePermission('queues'), (req: Request, res: Response) => {
    res.json({
      success: true,
      jobs: queueManager.getJobs(),
      stats: {
        active: queueManager.getJobs().filter((j) => j.status === 'active').length,
        waiting: queueManager.getJobs().filter((j) => j.status === 'waiting').length,
        completed: queueManager.getJobs().filter((j) => j.status === 'completed').length,
        failed: queueManager.getJobs().filter((j) => j.status === 'failed').length,
      },
    });
  });

  // Manual Trigger for Scheduler Cron
  app.post('/api/scheduler/cron-trigger', authMiddleware, requirePermission('queues'), async (req: Request, res: Response) => {
    try {
      const result = await schedulerCronService.triggerManualDispatch();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Live Logs
  app.get('/api/logs', authMiddleware, requirePermission('config'), (req: Request, res: Response) => {
    res.json({ success: true, logs: dbStore.logs });
  });

  // Codebase inspect endpoint for UI code explorer
  app.get('/api/codebase/files', authMiddleware, requirePermission('code'), (req: Request, res: Response) => {
    res.json({
      files: [
        { name: 'prisma/schema.prisma', path: 'prisma/schema.prisma', category: 'Database' },
        { name: 'src/config/env.ts', path: 'src/config/env.ts', category: 'Config' },
        { name: 'src/modules/drive/drive.service.ts', path: 'src/modules/drive/drive.service.ts', category: 'Integrations' },
        { name: 'src/modules/ai/gemini.service.ts', path: 'src/modules/ai/gemini.service.ts', category: 'Integrations' },
        { name: 'src/modules/whatsapp/whastmeo.client.ts', path: 'src/modules/whatsapp/whastmeo.client.ts', category: 'Integrations' },
        { name: 'src/modules/youtube/youtube.service.ts', path: 'src/modules/youtube/youtube.service.ts', category: 'Integrations' },
        { name: 'src/queues/queue.config.ts', path: 'src/queues/queue.config.ts', category: 'Queues' },
        { name: 'src/queues/workers/study.worker.ts', path: 'src/queues/workers/study.worker.ts', category: 'Queues' },
        { name: 'src/queues/scheduler/cron.jobs.ts', path: 'src/queues/scheduler/cron.jobs.ts', category: 'Queues' },
        { name: 'src/modules/ingest/ingest.controller.ts', path: 'src/modules/ingest/ingest.controller.ts', category: 'API' },
        { name: 'src/modules/content/content.controller.ts', path: 'src/modules/content/content.controller.ts', category: 'API' },
      ],
    });
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AutoHub Server] Servidor executando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
