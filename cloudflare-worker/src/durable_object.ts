import type {
  AgentToDoMessage,
  DoToAgentMessage,
  AdminBroadcastMessage,
  AgentStatus,
  WhatsAppStatus,
  SessionStatus,
  Job,
  JobStatus,
} from './protocol';
import { makeEnvelope } from './protocol';
import type { Bindings } from './auth';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface DOState {
  agentId: string | null;
  agentVersion: string | null;
  agentStatus: AgentStatus;
  whatsappStatus: WhatsAppStatus;
  sessionStatus: SessionStatus;
  lastSeen: number;
  lastError: string | null;
  qrCode: string | null;
  qrExpiresAt: string | null;
  qrVersion: number;
  paused: boolean;
  channels?: Array<{ jid: string; name: string; type: string }>;
}

const STALE_MS = 30_000;   // 30s sem heartbeat → STALE
const OFFLINE_MS = 90_000; // 90s sem heartbeat → OFFLINE

async function sha256Short(val: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(val));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 10);
}

// ─── Durable Object ───────────────────────────────────────────────────────────

export class AgentCoordinator {
  private state: DurableObjectState;
  private env: Bindings;
  private agentWs: WebSocket | null = null;
  private adminClients: Set<WebSocket> = new Set();
  private dispatchInterval: any = null;

  // Estado em memória (persistido em DO storage no shutdown)
  private data: DOState = {
    agentId: null,
    agentVersion: null,
    agentStatus: 'OFFLINE',
    whatsappStatus: 'DISCONNECTED',
    sessionStatus: 'NONE',
    lastSeen: 0,
    lastError: null,
    qrCode: null,
    qrExpiresAt: null,
    qrVersion: 0,
    paused: false,
    channels: [],
  };

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.env = env;
    // Restaurar estado persistido
    this.state.blockConcurrencyWhile(async () => {
      const saved = await this.state.storage.get<DOState>('state');
      if (saved) {
        this.data = { ...this.data, ...saved };
        const savedChannels = await this.state.storage.get<Array<{ jid: string; name: string; type: string }>>('channels');
        if (savedChannels) this.data.channels = savedChannels;
        // Agent reconectará; status é OFFLINE até recebermos REGISTER e QR é resetado
        this.data.agentStatus = 'OFFLINE';
        this.data.whatsappStatus = 'DISCONNECTED';
        this.data.qrCode = null;
        this.data.qrExpiresAt = null;
        this.data.qrVersion = 0;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');

    // Verificar tipo de cliente
    const mode = url.searchParams.get('mode'); // 'agent' ou 'admin'

    if (upgradeHeader === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      if (mode === 'agent') {
        await this.handleAgentWebSocket(server as WebSocket, request);
      } else {
        // mode === 'admin' (painel)
        await this.handleAdminWebSocket(server as WebSocket);
      }

      return new Response(null, { status: 101, webSocket: client as WebSocket });
    }

    // HTTP: status snapshot
    if (url.pathname.endsWith('/groups')) {
      return Response.json({ success: true, data: this.data.channels || [] });
    }

    if (url.pathname.endsWith('/status')) {
      return Response.json(this.getStatusSnapshot());
    }

    if (url.pathname.endsWith('/alarm') || url.pathname.endsWith('/check-scheduled')) {
      await this.dispatchReadyJobs();
      await this.scheduleNextAlarm();
      return Response.json({ success: true });
    }

    // HTTP: enviar comando ao agent
    if (url.pathname.endsWith('/command') && request.method === 'POST') {
      const body = await request.json<{ type: string; payload?: Record<string, unknown> }>();
      return this.handleAdminCommand(body);
    }

    // HTTP: dispatch de job
    if (url.pathname.endsWith('/dispatch') && request.method === 'POST') {
      const job = await request.json<Job>();
      return this.dispatchJob(job);
    }

    return new Response('Not found', { status: 404 });
  }

  // ─── Agent WebSocket ────────────────────────────────────────────────────────

  private async handleAgentWebSocket(ws: WebSocket, request: Request): Promise<void> {
    (ws as any).accept();

    // Se já havia um agent conectado, fechar a conexão antiga
    if (this.agentWs) {
      try { this.agentWs.close(1000, 'New agent connected'); } catch { }
    }
    this.agentWs = ws;

    // Iniciar verificação periódica de jobs agendados enquanto o agent estiver conectado
    if (!this.dispatchInterval) {
      this.dispatchInterval = setInterval(() => {
        this.dispatchReadyJobs().catch(console.error);
      }, 10000);
    }

    ws.addEventListener('message', async (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as AgentToDoMessage;
        await this.processAgentMessage(msg);
      } catch (e) {
        console.error('[DO] Error processing agent message:', e);
      }
    });

    ws.addEventListener('close', () => {
      if (this.agentWs === ws) {
        if (this.dispatchInterval) {
          clearInterval(this.dispatchInterval);
          this.dispatchInterval = null;
        }
        this.agentWs = null;
        this.data.agentStatus = 'OFFLINE';
        this.data.whatsappStatus = 'DISCONNECTED';
        this.data.qrCode = null;
        this.data.qrExpiresAt = null;
        this.data.qrVersion = 0;
        this.broadcastStatus();
      }
    });

    ws.addEventListener('error', () => {
      console.error('[DO] Agent WebSocket error');
    });
  }

  private async processAgentMessage(msg: AgentToDoMessage): Promise<void> {
    switch (msg.type) {
      case 'REGISTER_AGENT': {
        this.data.agentId = msg.agentId;
        this.data.agentVersion = msg.agentVersion;
        this.data.agentStatus = 'ONLINE';
        this.data.lastSeen = Date.now();
        this.data.qrCode = null;
        this.data.qrExpiresAt = null;
        this.data.qrVersion = 0;
        await this.persist();

        // Aceitar o agent
        this.sendToAgent(makeEnvelope({
          type: 'AGENT_ACCEPTED',
          serverId: 'do-coordinator-v1',
          serverTime: new Date().toISOString(),
        }));

        // Sincronizar jobs pendentes
        await this.syncPendingJobs();

        this.broadcastStatus();
        break;
      }

      case 'HEARTBEAT': {
        this.data.lastSeen = Date.now();
        if (msg.whatsappStatus === 'CONNECTED') {
          await this.dispatchReadyJobs();
        }
        this.data.agentStatus = 'ONLINE';
        this.data.whatsappStatus = msg.whatsappStatus;
        this.data.sessionStatus = msg.sessionStatus;
        if (msg.whatsappStatus !== 'WAITING_QR') {
          this.data.qrCode = null;
          this.data.qrExpiresAt = null;
        }
        this.broadcastStatus();
        break;
      }

      case 'STATUS_UPDATE': {
        this.data.lastSeen = Date.now();
        this.data.agentStatus = 'ONLINE';
        this.data.whatsappStatus = msg.whatsappStatus;
        this.data.sessionStatus = msg.sessionStatus;
        this.data.lastError = msg.lastError ?? null;
        if (msg.agentVersion) this.data.agentVersion = msg.agentVersion;

        // Se status não for WAITING_QR, limpar QR ativo
        if (msg.whatsappStatus !== 'WAITING_QR') {
          this.data.qrCode = null;
          this.data.qrExpiresAt = null;
        }

        await this.persist();
        this.broadcastStatus();
        break;
      }

      case 'QR_UPDATE': {
        this.data.qrCode = msg.qrCode;
        this.data.qrExpiresAt = msg.expiresAt;
        this.data.qrVersion = msg.qrVersion || (this.data.qrVersion || 0) + 1;
        this.data.whatsappStatus = 'WAITING_QR';
        this.data.lastSeen = Date.now();

        const qrHash = await sha256Short(msg.qrCode);
        console.log(`[DO] QR_UPDATE -> Versao: ${this.data.qrVersion}, Hash: ${qrHash}, Tamanho: ${msg.qrCode.length}, ExpiraEm: ${msg.expiresAt}`);

        await this.persist();

        this.broadcastToAdmins(makeEnvelope({
          type: 'ADMIN_QR',
          qrCode: msg.qrCode,
          expiresAt: msg.expiresAt,
          qrVersion: this.data.qrVersion,
          qrHash,
          generatedAt: msg.generatedAt || new Date().toISOString(),
        }));
        this.broadcastStatus();
        break;
      }

      case 'SESSION_UPDATE': {
        this.data.sessionStatus = msg.sessionStatus;
        await this.persist();
        this.broadcastStatus();
        break;
      }

      case 'JOB_ACK': {
        const newStatus = msg.status === 'SENT' ? 'SENT' : (msg.status as JobStatus);
        await this.updateJobStatus(msg.jobId, newStatus, undefined, msg.sentAt);

        this.broadcastToAdmins(makeEnvelope({
          type: 'ADMIN_JOB_UPDATE',
          jobId: msg.jobId,
          status: newStatus,
          sentAt: msg.sentAt,
        }));
        break;
      }

      case 'CHANNELS_UPDATE': {
        this.data.channels = (msg as any).channels || [];
        await this.state.storage.put('channels', this.data.channels);
        if (this.env.TELEIOS_KV) {
          await this.env.TELEIOS_KV.put('teleios:channels', JSON.stringify(this.data.channels));
        }
        await this.persist();
        console.log(`[DO] ${this.data.channels?.length || 0} canais/grupos sincronizados do Agent Go.`);
        this.broadcastToAdmins(makeEnvelope({
          type: 'ADMIN_CHANNELS' as any,
          channels: this.data.channels,
        } as any));
        break;
      }

      case 'JOB_FAILED': {
        const job = await this.state.storage.get<Job>(`job:${msg.jobId}`);
        const currentAttempts = ((job?.attempts || 0) + 1);
        const canRetry = msg.retryable && currentAttempts < 3;
        const finalStatus = canRetry ? ('RETRYING' as JobStatus) : ('FAILED' as JobStatus);

        let nextSchedule: string | undefined = undefined;
        if (canRetry) {
          const delayMs = Math.min(60_000 * Math.pow(2, currentAttempts - 1), 300_000);
          nextSchedule = new Date(Date.now() + delayMs).toISOString();
          await this.state.storage.setAlarm(Date.now() + delayMs);
        }

        await this.updateJobStatus(msg.jobId, finalStatus, msg.error, undefined, currentAttempts, nextSchedule);

        this.broadcastToAdmins(makeEnvelope({
          type: 'ADMIN_JOB_UPDATE',
          jobId: msg.jobId,
          status: finalStatus,
          error: msg.error,
        }));
        break;
      }
    }
  }

  // ─── Admin WebSocket ────────────────────────────────────────────────────────

  private async handleAdminWebSocket(ws: WebSocket): Promise<void> {
    (ws as any).accept();
    this.adminClients.add(ws);

    const isWaitingQr = this.data.whatsappStatus === 'WAITING_QR';
    const isOffline = this.computeAgentStatus() === 'OFFLINE';
    const hasValidQr = !isOffline && isWaitingQr && Boolean(
      this.data.qrCode &&
      this.data.qrExpiresAt &&
      new Date(this.data.qrExpiresAt) > new Date()
    );

    // Enviar estado atual imediatamente ao novo cliente admin
    ws.send(JSON.stringify(makeEnvelope({
      type: 'ADMIN_STATUS',
      agentStatus: this.computeAgentStatus(),
      whatsappStatus: this.data.whatsappStatus,
      sessionStatus: this.data.sessionStatus,
      lastSeen: this.data.lastSeen,
      lastError: this.data.lastError ?? undefined,
      qrCode: hasValidQr ? this.data.qrCode : null,
      qrExpiresAt: hasValidQr ? this.data.qrExpiresAt : null,
      qrVersion: hasValidQr ? this.data.qrVersion : undefined,
    })));

    // Se houver QR ativo, enviar também
    if (hasValidQr && this.data.qrCode && this.data.qrExpiresAt) {
      ws.send(JSON.stringify(makeEnvelope({
        type: 'ADMIN_QR',
        qrCode: this.data.qrCode,
        expiresAt: this.data.qrExpiresAt,
        qrVersion: this.data.qrVersion,
      })));
    }

    ws.addEventListener('close', () => {
      this.adminClients.delete(ws);
    });

    ws.addEventListener('error', () => {
      this.adminClients.delete(ws);
    });

    // Admin pode enviar comandos via WebSocket também
    ws.addEventListener('message', async (event: MessageEvent) => {
      try {
        const cmd = JSON.parse(event.data as string);
        await this.handleAdminCommand(cmd);
      } catch { }
    });
  }

  // ─── Comandos admin ─────────────────────────────────────────────────────────

  private async handleAdminCommand(body: { type: string; payload?: Record<string, unknown> }): Promise<Response> {
    if (!this.agentWs) {
      return Response.json({ success: false, error: 'Agent não conectado.' }, { status: 503 });
    }

    switch (body.type) {
      case 'PAUSE':
        this.data.paused = true;
        this.sendToAgent(makeEnvelope({ type: 'PAUSE' }));
        break;
      case 'SYNC_GROUPS':
        this.sendToAgent(makeEnvelope({ type: 'SYNC_GROUPS' }));
        break;
      case 'CONNECT_WA':
        // Solicitação explícita de primeira conexão. Não limpa QR nem device store.
        // O agent iniciará a sessão e solicitará QR Code se necessário.
        this.data.whatsappStatus = 'STARTING';
        this.broadcastStatus();
        this.sendToAgent(makeEnvelope({ type: 'CONNECT_WA' }));
        break;
      case 'RESTART_WA':
        // Limpar QR imediatamente ao solicitar reinício
        this.data.qrCode = null;
        this.data.qrExpiresAt = null;
        this.data.qrVersion = 0;
        this.data.whatsappStatus = 'STARTING';
        this.broadcastStatus();
        this.sendToAgent(makeEnvelope({ type: 'RESTART_WA' }));
        break;
      case 'RESUME':
        this.data.paused = false;
        this.sendToAgent(makeEnvelope({ type: 'RESUME' }));
        break;
      case 'RECONNECT':
        // O agent trata isso internamente via connection manager; apenas enviamos STATUS_UPDATE
        // Na prática, desconectamos o WS e o agent detecta e reconecta
        this.agentWs.close(1000, 'Admin requested reconnect');
        break;
      default:
        return Response.json({ success: false, error: 'Comando desconhecido.' }, { status: 400 });
    }

    return Response.json({ success: true });

  }

  // ─── Job dispatch ───────────────────────────────────────────────────────────

  private async dispatchJob(job: Job): Promise<Response> {
    const isFuture = Boolean(job.scheduledAt && new Date(job.scheduledAt).getTime() > Date.now());
    job.status = isFuture ? 'PENDING' : 'READY';

    // Salvar job no DO storage
    await this.state.storage.put(`job:${job.id}`, job);
    await this.scheduleNextAlarm();

    // Se NÃO for futuro e agent está conectado e WhatsApp conectado e não pausado, enviar imediatamente
    if (!isFuture && this.agentWs && !this.data.paused) {
      console.log(`[DO] Enviando SEND_JOB imediato para o Agent Go: jobId=${job.id}, recipient=${job.recipientJid}`);
      job.status = 'CLAIMED';
      await this.state.storage.put(`job:${job.id}`, job);
      this.sendToAgent(makeEnvelope({
        type: 'SEND_JOB',
        jobId: job.id,
        studyId: job.studyId,
        channelId: job.channelId,
        recipientJid: job.recipientJid,
        content: job.content,
        mediaUrl: job.mediaUrl,
      }));
    }

    return Response.json({ success: true, jobId: job.id });
  }

  // ─── Sync de jobs pendentes ─────────────────────────────────────────────────

  private async syncPendingJobs(): Promise<void> {
    const allJobs = await this.state.storage.list<Job>({ prefix: 'job:' });
    const now = new Date();

    const pendingJobs: Job[] = [];
    for (const [, job] of allJobs) {
      if (
        job.status === 'PENDING' ||
        job.status === 'READY' ||
        job.status === 'CLAIMED' ||
        job.status === 'RETRYING'
      ) {
        // Job elegível: sem scheduledAt ou scheduledAt já passou
        const scheduled = job.scheduledAt ? new Date(job.scheduledAt) : null;
        if (!scheduled || scheduled <= now) {
          pendingJobs.push(job);
        }
      }
    }

    if (pendingJobs.length === 0) return;

    // Enviar SYNC_RESPONSE com os jobs pendentes
    const syncMsg = makeEnvelope({
      type: 'SYNC_RESPONSE',
      pendingJobs: pendingJobs.map((j) => ({
        type: 'SEND_JOB',
        version: 1 as const,
        requestId: j.id,
        timestamp: new Date().toISOString(),
        jobId: j.id,
        studyId: j.studyId,
        channelId: j.channelId,
        recipientJid: j.recipientJid,
        content: j.content,
        mediaUrl: j.mediaUrl,
      })),
    });

    this.sendToAgent(syncMsg);
  }

  /** Dispara jobs cujo agendamento venceu quando o alarme do DO é acordado. */
  async alarm(): Promise<void> {
    await this.dispatchReadyJobs();
    await this.scheduleNextAlarm();
  }

  private async dispatchReadyJobs(): Promise<void> {
    if (!this.agentWs || this.data.whatsappStatus !== 'CONNECTED' || this.data.paused) return;
    const allJobs = await this.state.storage.list<Job>({ prefix: 'job:' });
    const current = Date.now();
    for (const [, job] of allJobs) {
      if (job.status !== 'PENDING' && job.status !== 'READY' && job.status !== 'RETRYING') continue;
      if (job.scheduledAt && new Date(job.scheduledAt).getTime() > current) continue;

      console.log(`[DO] Despachando job agendado/pronto para o Agent Go: jobId=${job.id}, recipient=${job.recipientJid}`);
      job.status = 'CLAIMED';
      await this.state.storage.put(`job:${job.id}`, job);

      this.sendToAgent(makeEnvelope({
        type: 'SEND_JOB',
        jobId: job.id,
        studyId: job.studyId,
        channelId: job.channelId,
        recipientJid: job.recipientJid,
        content: job.content,
        mediaUrl: job.mediaUrl,
      }));
    }
  }

  private async scheduleNextAlarm(): Promise<void> {
    const jobs = await this.state.storage.list<Job>({ prefix: 'job:' });
    const future = [...jobs.values()]
      .filter((job) => (job.status === 'PENDING' || job.status === 'READY' || job.status === 'RETRYING') && job.scheduledAt)
      .map((job) => new Date(job.scheduledAt!).getTime())
      .filter((time) => Number.isFinite(time) && time > Date.now())
      .sort((a, b) => a - b)[0];
    if (future) await this.state.storage.setAlarm(future);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private sendToAgent(msg: object): void {
    if (this.agentWs) {
      try {
        this.agentWs.send(JSON.stringify(msg));
      } catch (e) {
        console.error('[DO] Failed to send to agent:', e);
      }
    }
  }

  private broadcastToAdmins(msg: object): void {
    const data = JSON.stringify(msg);
    for (const ws of this.adminClients) {
      try {
        ws.send(data);
      } catch {
        this.adminClients.delete(ws);
      }
    }
  }

  private computeAgentStatus(): AgentStatus {
    if (!this.data.lastSeen) return 'OFFLINE';
    const age = Date.now() - this.data.lastSeen;
    if (age < STALE_MS) return 'ONLINE';
    if (age < OFFLINE_MS) return 'STALE';
    return 'OFFLINE';
  }

  private broadcastStatus(): void {
    const isWaitingQr = this.data.whatsappStatus === 'WAITING_QR';
    const isOffline = this.computeAgentStatus() === 'OFFLINE';
    const hasValidQr = !isOffline && isWaitingQr && Boolean(
      this.data.qrCode &&
      this.data.qrExpiresAt &&
      new Date(this.data.qrExpiresAt) > new Date()
    );

    this.broadcastToAdmins(makeEnvelope({
      type: 'ADMIN_STATUS',
      agentStatus: this.computeAgentStatus(),
      whatsappStatus: this.data.whatsappStatus,
      sessionStatus: this.data.sessionStatus,
      lastSeen: this.data.lastSeen,
      lastError: this.data.lastError ?? undefined,
      qrCode: hasValidQr ? this.data.qrCode : null,
      qrExpiresAt: hasValidQr ? this.data.qrExpiresAt : null,
      qrVersion: hasValidQr ? this.data.qrVersion : undefined,
    }));
  }

  private getStatusSnapshot() {
    const isWaitingQr = this.data.whatsappStatus === 'WAITING_QR';
    const isOffline = this.computeAgentStatus() === 'OFFLINE';
    const hasValidQr = !isOffline && isWaitingQr && Boolean(
      this.data.qrCode &&
      this.data.qrExpiresAt &&
      new Date(this.data.qrExpiresAt) > new Date()
    );

    return {
      agentId: this.data.agentId,
      agentVersion: this.data.agentVersion,
      agentStatus: this.computeAgentStatus(),
      whatsappStatus: this.data.whatsappStatus,
      sessionStatus: this.data.sessionStatus,
      lastSeen: this.data.lastSeen,
      lastError: this.data.lastError,
      paused: this.data.paused,
      hasQr: hasValidQr,
      qrCode: hasValidQr ? this.data.qrCode : null,
      qrExpiresAt: hasValidQr ? this.data.qrExpiresAt : null,
      qrVersion: hasValidQr ? this.data.qrVersion : undefined,
    };
  }

  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    error?: string,
    sentAt?: string,
    attempts?: number,
    scheduledAt?: string
  ): Promise<void> {
    const job = await this.state.storage.get<Job>(`job:${jobId}`);
    if (!job) return;
    const updated: Job = {
      ...job,
      status,
      updatedAt: new Date().toISOString(),
      ...(error !== undefined && { lastError: error }),
      ...(sentAt && { sentAt }),
      ...(attempts !== undefined && { attempts }),
      ...(scheduledAt && { scheduledAt }),
      ...(status === 'CLAIMED' && { claimedAt: new Date().toISOString() }),
    };
    await this.state.storage.put(`job:${jobId}`, updated);

    // Sincronizar com KV para persistência e visualização do Admin
    if (this.env?.TELEIOS_KV) {
      try {
        const jobs = (await this.env.TELEIOS_KV.get<Job[]>('teleios:jobs', 'json')) || [];
        const idx = jobs.findIndex((j) => j.id === jobId);
        if (idx !== -1) {
          jobs[idx] = updated;
        } else {
          jobs.unshift(updated);
        }
        await this.env.TELEIOS_KV.put('teleios:jobs', JSON.stringify(jobs));

        // Quando enviado com sucesso, atualizar estudo correspondente
        if (status === 'SENT' && updated.studyId) {
          const studies = (await this.env.TELEIOS_KV.get<any[]>('teleios:studies', 'json')) || [];
          const sIdx = studies.findIndex((s) => s.id === updated.studyId);
          if (sIdx !== -1) {
            studies[sIdx].sentToWhatsapp = true;
            studies[sIdx].sentAt = sentAt || new Date().toISOString();
            await this.env.TELEIOS_KV.put('teleios:studies', JSON.stringify(studies));
          }
        }
      } catch (kvErr) {
        console.error('[DO] Erro ao sincronizar job com KV:', kvErr);
      }
    }
  }

  private async persist(): Promise<void> {
    await this.state.storage.put('state', this.data);
  }
}
