import { env } from '../config/env.ts';
import { dbStore } from '../data/mockStore.ts';
import { QueueJob } from '../types/index.ts';

export type QueueName = 'study-processing' | 'whatsapp-dispatch' | 'youtube-upload';

export interface BaseJobData {
  jobId?: string;
  timestamp?: string;
  [key: string]: any;
}

export class QueueManager {
  private redisUrl: string;

  constructor() {
    this.redisUrl = env.REDIS_URL;
  }

  /**
   * Adiciona um trabalho à fila BullMQ correspondente
   */
  async addJob<T extends BaseJobData>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: { delay?: number; priority?: number }
  ): Promise<QueueJob> {
    const job: QueueJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: jobName,
      queue: queueName,
      data,
      status: options?.delay ? 'delayed' : 'waiting',
      progress: 0,
      timestamp: new Date().toISOString(),
    };

    dbStore.queueJobs.unshift(job);
    dbStore.addLog('info', `Job adicionado na fila [${queueName}]: ${jobName}`, 'BullMQ');

    return job;
  }

  getJobs(): QueueJob[] {
    return dbStore.queueJobs;
  }

  updateJobStatus(jobId: string, status: 'active' | 'completed' | 'failed' | 'delayed', progress = 100, reason?: string) {
    const job = dbStore.queueJobs.find((j) => j.id === jobId);
    if (job) {
      job.status = status;
      job.progress = progress;
      if (reason) job.failedReason = reason;
    }
  }
}

export const queueManager = new QueueManager();
