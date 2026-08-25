import { ContentCategory, ProcessingStatus, MediaFile, Study, VideoMetadata, QueueJob, User, UserRole, PermissionModule, CreateUserInput, UpdateUserInput } from '../types/index.ts';
import { simpleHash, hashPassword, getLockoutExpiry, MAX_LOGIN_ATTEMPTS, isAccountLocked } from '../services/security.service.ts';

// Hash pre-computado de 'admin' com salt 'teleios-salt-admin-2026'
// Gerado via simpleHash para inicialização síncrona do seed
const ADMIN_INITIAL_HASH = simpleHash('teleios-salt-admin-2026admin');

class InMemoryStore {
  public files: MediaFile[] = [];
  public studies: Study[] = [];
  public videos: VideoMetadata[] = [];
  public queueJobs: QueueJob[] = [];
  public users: User[] = [];
  public logs: { id: string; timestamp: string; level: 'info' | 'warn' | 'success' | 'error'; message: string; channel: string }[] = [];

  constructor() {
    this.seedInitialData();
  }


  private seedInitialData() {
    // 1. Estudo Inicial 1
    const file1: MediaFile = {
      id: 'file-estudo-01',
      originalName: 'maturidade_crista_efesios_4_13.pdf',
      mimeType: 'application/pdf',
      size: 2450000,
      category: ContentCategory.ESTUDO,
      driveFileId: '1AbC_drive_estudo_01',
      driveWebViewLink: 'https://drive.google.com/file/d/1AbC_drive_estudo_01/view',
      driveFolderPath: '/2026/08/ESTUDO',
      status: ProcessingStatus.COMPLETED,
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    };

    const study1: Study = {
      id: 'study-01',
      fileId: file1.id,
      rawContent: `Estudo sobre o chamado à maturidade cristã baseado em Efésios 4:13. O apóstolo Paulo nos exorta a crescermos "até que todos alcancemos a medida da estatura da plenitude de Cristo". Este estudo explora o que significa ser um discípulo maduro, a importância do discipulado contínuo e como a Palavra de Deus nos transforma progressivamente.`,
      summary: `Síntese do Estudo:\nA maturidade cristã não é um destino, mas uma jornada contínua de transformação pelo poder da Palavra. Paulo nos ensina que o objetivo do ministério é conduzir cada crente à estatura completa de Cristo. Isso envolve acolhimento, discipulado intencional, oração perseverante e cuidado integral da vida emocional e espiritual.`,
      aiImagePrompt: `Serene illustration of a path leading toward radiant light, symbolizing spiritual growth and the journey toward maturity in Christ, warm golden tones, peaceful atmosphere, 8k`,
      generatedImgUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
      scheduledAt: new Date(Date.now() + 3600000 * 2).toISOString(),
      sentToWhatsapp: true,
      sentAt: new Date(Date.now() - 3600000).toISOString(),
      whatsappMessageId: 'wmeo_vps_994821',
      createdAt: file1.createdAt,
      mediaFile: file1,
    };
    file1.study = study1;

    // 2. Estudo Inicial 2 (Pendente de Disparo)
    const file2: MediaFile = {
      id: 'file-estudo-02',
      originalName: 'restauracao_e_cuidado_pastoral_2timoteo.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 1820000,
      category: ContentCategory.ESTUDO,
      driveFileId: '2XyZ_drive_estudo_02',
      driveWebViewLink: 'https://drive.google.com/file/d/2XyZ_drive_estudo_02/view',
      driveFolderPath: '/2026/08/ESTUDO',
      status: ProcessingStatus.COMPLETED,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    };

    const study2: Study = {
      id: 'study-02',
      fileId: file2.id,
      rawContent: `Estudo sobre restauração e cuidado pastoral baseado em 2 Timóteo 3:17. "A fim de que o homem de Deus seja perfeito e perfeitamente habilitado para toda boa obra." Este estudo aborda como a igreja pode ser instrumento de restauração para os feridos, fortalecimento para os enfraquecidos e capacitação para que cada pessoa descubra sua identidade, dons e chamado em Cristo.`,
      summary: `Resumo do Estudo:\nO cuidado integral envolve acolher os feridos com compaixão, ensinar a Palavra com fidelidade, desenvolver maturidade cristã through discipulado relacional, e ajudar cada pessoa a descobrir seus dons espirituais. A restauração não é apenas emocional, mas um processo holistic que toca corpo, alma e espírito.`,
      aiImagePrompt: `Compassionate illustration of hands reaching out to help someone rise, warm embrace, symbol of restoration and hope in Christ, soft golden light, serene atmosphere, 8k`,
      generatedImgUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=800&q=80',
      scheduledAt: new Date(new Date().setHours(18, 0, 0, 0)).toISOString(),
      sentToWhatsapp: false,
      sentAt: null,
      createdAt: file2.createdAt,
      mediaFile: file2,
    };
    file2.study = study2;

    // 3. Galeria Inicial
    const file3: MediaFile = {
      id: 'file-galeria-01',
      originalName: 'banner_arquitetura_cloud_diagram.png',
      mimeType: 'image/png',
      size: 3400000,
      category: ContentCategory.GALERIA,
      driveFileId: '3Img_drive_galeria_01',
      driveWebViewLink: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
      driveFolderPath: '/2026/08/GALERIA',
      status: ProcessingStatus.COMPLETED,
      createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    };

    const file4: MediaFile = {
      id: 'file-galeria-02',
      originalName: 'interface_dashboard_concept.jpg',
      mimeType: 'image/jpeg',
      size: 4200000,
      category: ContentCategory.GALERIA,
      driveFileId: '4Img_drive_galeria_02',
      driveWebViewLink: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
      driveFolderPath: '/2026/08/GALERIA',
      status: ProcessingStatus.COMPLETED,
      createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    };

    // 4. Vídeo Inicial
    const file5: MediaFile = {
      id: 'file-video-01',
      originalName: 'apresentacao_pipeline_autohub_v1.mp4',
      mimeType: 'video/mp4',
      size: 45000000,
      category: ContentCategory.VIDEO,
      driveFileId: '5Vid_drive_01',
      driveWebViewLink: 'https://drive.google.com/file/d/5Vid_drive_01/view',
      driveFolderPath: '/2026/08/VIDEO',
      youtubeVideoId: 'jNQXAC9IVRw',
      status: ProcessingStatus.COMPLETED,
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    };

    const video1: VideoMetadata = {
      id: 'video-meta-01',
      fileId: file5.id,
      title: 'Ministério Teleios — Conduzindo vidas a Cristo',
      description: 'Mensagem sobre a missão do Ministério Teleios: conduzir pessoas a um relacionamento verdadeiro e transformador com Jesus Cristo através da Palavra, do discipulado, da oração e do cuidado integral.',
      tags: ['Teleios', 'JesusCristo', 'Discipulado', 'Restauracao', 'Palavra', 'Oracao'],
      scheduledAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      published: true,
      publishedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      youtubeUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      mediaFile: file5,
    };
    file5.videoMetadata = video1;

    // 5. Projeto & Apoio
    const file6: MediaFile = {
      id: 'file-projeto-01',
      originalName: 'especificacao_tecnica_whastmeo_vps.pdf',
      mimeType: 'application/pdf',
      size: 1500000,
      category: ContentCategory.PROJETO,
      driveFileId: '6Doc_drive_projeto_01',
      driveWebViewLink: 'https://drive.google.com/file/d/6Doc_drive_projeto_01/view',
      driveFolderPath: '/2026/08/PROJETO',
      status: ProcessingStatus.COMPLETED,
      createdAt: new Date(Date.now() - 3600000 * 16).toISOString(),
    };

    const file7: MediaFile = {
      id: 'file-apoio-01',
      originalName: 'guia_credenciais_google_service_account.md',
      mimeType: 'text/markdown',
      size: 45000,
      category: ContentCategory.APOIO,
      driveFileId: '7Doc_drive_apoio_01',
      driveWebViewLink: 'https://drive.google.com/file/d/7Doc_drive_apoio_01/view',
      driveFolderPath: '/2026/08/APOIO',
      status: ProcessingStatus.COMPLETED,
      createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    };

    this.files = [file1, file2, file3, file4, file5, file6, file7];
    this.studies = [study1, study2];
    this.videos = [video1];

    // Filas Iniciais de Demonstração
    this.queueJobs = [
      {
        id: 'job-01',
        name: 'Processar Estudo via Gemini',
        queue: 'study-processing',
        data: { fileId: file1.id, originalName: file1.originalName },
        status: 'completed',
        progress: 100,
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: 'job-02',
        name: 'Disparo WhatsApp Whastmeo (12:00)',
        queue: 'whatsapp-dispatch',
        data: { studyId: study1.id, recipient: '5511999998888' },
        status: 'completed',
        progress: 100,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'job-03',
        name: 'Disparo WhatsApp Whastmeo (18:00)',
        queue: 'whatsapp-dispatch',
        data: { studyId: study2.id, recipient: '5511999998888' },
        status: 'waiting',
        progress: 0,
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: 'job-04',
        name: 'Upload YouTube Unlisted',
        queue: 'youtube-upload',
        data: { videoId: video1.id, title: video1.title },
        status: 'completed',
        progress: 100,
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
    ];

    // ==========================================
    // SEED: USUÁRIO SUPERADMIN INICIAL (admin/admin)
    // ==========================================
    const now = new Date().toISOString();
    const adminUser: User = {
      id: 'user-superadmin-001',
      username: 'admin',
      // Hash de 'admin' com salt 'teleios-salt-admin-2026'
      // Na produção, a senha deve ser alterada imediatamente via painel
      passwordHash: ADMIN_INITIAL_HASH,
      role: 'superadmin',
      permissions: ['*'],
      displayName: 'Super Administrador',
      createdAt: now,
      updatedAt: now,
      active: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
    };
    this.users = [adminUser];

    this.addLog('info', 'Serviço de Ingestão e Filas BullMQ inicializado.', 'System');
    this.addLog('success', 'Conexão com Google Drive API (/2026/08/...) estabelecida.', 'GoogleDrive');
    this.addLog('info', 'Gemini AI Studio SDK pronto para síntese.', 'Gemini');
    this.addLog('success', 'Whastmeo WhatsApp VPS Gateway pronto.', 'WhatsApp');
    this.addLog('info', 'Scheduler Cron configurado para 12:00 e 18:00 diariamente.', 'Cron');
    this.addLog('success', 'Sistema de autenticação RBAC inicializado — Superadmin ativo.', 'Auth');
  }

  public addLog(level: 'info' | 'warn' | 'success' | 'error', message: string, channel: string) {
    this.logs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      channel,
    });
    if (this.logs.length > 100) {
      this.logs.pop();
    }
  }

  // ==========================================
  // USER CRUD
  // ==========================================

  /** Encontra usuário por username (case-insensitive) */
  public findUserByUsername(username: string): User | undefined {
    return this.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  }

  /** Encontra usuário por ID */
  public findUserById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  /** Retorna todos os usuários (sem passwordHash) */
  public listUsers(): Omit<User, 'passwordHash'>[] {
    return this.users.map(({ passwordHash, ...rest }) => rest);
  }

  /** Cria um novo usuário (apenas Superadmin pode chamar) */
  public async createUser(input: CreateUserInput): Promise<Omit<User, 'passwordHash'>> {
    const existing = this.findUserByUsername(input.username);
    if (existing) throw new Error('Nome de usuário já está em uso.');

    const { hashPassword: hash } = await import('../services/security.service.ts');
    const passwordHash = await hash(input.password, input.username);
    const now = new Date().toISOString();

    const newUser: User = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      username: input.username.toLowerCase().trim(),
      passwordHash,
      role: input.role,
      permissions: input.permissions,
      displayName: input.displayName.trim(),
      createdAt: now,
      updatedAt: now,
      active: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
    };

    this.users.push(newUser);
    this.addLog('success', `Novo usuário criado: ${newUser.displayName} (${newUser.role})`, 'Auth');
    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser;
  }

  /** Atualiza um usuário existente */
  public async updateUser(id: string, input: UpdateUserInput): Promise<Omit<User, 'passwordHash'>> {
    const userIdx = this.users.findIndex((u) => u.id === id);
    if (userIdx === -1) throw new Error('Usuário não encontrado.');

    const user = this.users[userIdx];
    if (user.role === 'superadmin' && input.role && input.role !== 'superadmin') {
      throw new Error('Não é possível rebaixar o Superadmin.');
    }

    const updated: User = {
      ...user,
      ...(input.displayName && { displayName: input.displayName.trim() }),
      ...(input.role && { role: input.role }),
      ...(input.permissions && { permissions: input.permissions }),
      ...(typeof input.active !== 'undefined' && { active: input.active }),
      updatedAt: new Date().toISOString(),
    };

    if (input.newPassword) {
      const { hashPassword: hash } = await import('../services/security.service.ts');
      updated.passwordHash = await hash(input.newPassword, user.username);
      updated.failedLoginAttempts = 0;
      updated.lockedUntil = null;
    }

    this.users[userIdx] = updated;
    this.addLog('info', `Usuário atualizado: ${updated.displayName}`, 'Auth');
    const { passwordHash: _, ...safeUser } = updated;
    return safeUser;
  }

  /** Remove um usuário (não pode remover o Superadmin inicial) */
  public deleteUser(id: string): void {
    const user = this.findUserById(id);
    if (!user) throw new Error('Usuário não encontrado.');
    if (user.id === 'user-superadmin-001') throw new Error('O Superadmin inicial não pode ser removido.');
    this.users = this.users.filter((u) => u.id !== id);
    this.addLog('warn', `Usuário removido: ${user.displayName} (${user.username})`, 'Auth');
  }

  /**
   * Autentica um usuário.
   * Verifica bloqueio de conta, hash de senha e atualiza contadores de tentativas.
   */
  public async authenticateUser(
    username: string,
    password: string
  ): Promise<{ success: boolean; user?: User; error?: string; lockedSeconds?: number }> {
    const user = this.findUserByUsername(username);

    if (!user) {
      return { success: false, error: 'Credenciais inválidas.' };
    }

    if (!user.active) {
      return { success: false, error: 'Conta desativada. Contate o administrador.' };
    }

    // Verificar bloqueio
    const lockStatus = isAccountLocked(user);
    if (lockStatus.locked) {
      return {
        success: false,
        error: `Conta bloqueada temporariamente. Tente novamente em ${Math.ceil(lockStatus.secondsRemaining / 60)} minuto(s).`,
        lockedSeconds: lockStatus.secondsRemaining,
      };
    }

    // Para o seed inicial (admin/admin), usar simpleHash
    let passwordHash: string;
    if (user.id === 'user-superadmin-001') {
      const { simpleHash: sh } = await import('../services/security.service.ts');
      passwordHash = sh(`teleios-salt-${user.username}-2026${password}`);
    } else {
      const { hashPassword: hp } = await import('../services/security.service.ts');
      passwordHash = await hp(password, user.username);
    }

    if (passwordHash !== user.passwordHash) {
      // Incrementar tentativas falhas
      const userIdx = this.users.findIndex((u) => u.id === user.id);
      this.users[userIdx].failedLoginAttempts += 1;

      if (this.users[userIdx].failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        this.users[userIdx].lockedUntil = getLockoutExpiry();
        this.addLog('warn', `Conta bloqueada por excesso de tentativas: ${user.username}`, 'Auth');
        return {
          success: false,
          error: `Conta bloqueada por ${15} minutos após múltiplas tentativas inválidas.`,
          lockedSeconds: 15 * 60,
        };
      }

      const remaining = MAX_LOGIN_ATTEMPTS - this.users[userIdx].failedLoginAttempts;
      return {
        success: false,
        error: `Credenciais inválidas. ${remaining} tentativa(s) restante(s).`,
      };
    }

    // Login bem-sucedido
    const userIdx = this.users.findIndex((u) => u.id === user.id);
    this.users[userIdx].failedLoginAttempts = 0;
    this.users[userIdx].lockedUntil = null;
    this.users[userIdx].lastLoginAt = new Date().toISOString();

    this.addLog('success', `Login bem-sucedido: ${user.displayName} (${user.role})`, 'Auth');
    return { success: true, user: this.users[userIdx] };
  }
}

export const dbStore = new InMemoryStore();

