import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { processAuditJob } from './processors';

export interface AuditJobData {
  clientId: string;
  auditType: string;
  runId: string;
  priority?: number;
  metadata?: Record<string, any>;
}

// Create the audit queue
export const auditQueue = new Queue<AuditJobData>('audit-queue', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Queue event listeners
auditQueue.on('error', (error) => {
  logger.error({ error }, 'Audit queue error');
});

auditQueue.on('waiting', (job) => {
  logger.debug({ jobId: job.id }, 'Job waiting in queue');
});

// Queue event listeners with proper typing
(auditQueue as any).on('active', (job: any) => {
  logger.info({ 
    jobId: job.id, 
    clientId: job.data.clientId,
    auditType: job.data.auditType 
  }, 'Job started processing');
});

(auditQueue as any).on('completed', (job: any) => {
  logger.info({ 
    jobId: job.id, 
    clientId: job.data.clientId,
    auditType: job.data.auditType,
    duration: Date.now() - job.processedOn!
  }, 'Job completed successfully');
});

(auditQueue as any).on('failed', (job: any, error: any) => {
  logger.error({ 
    jobId: job?.id, 
    clientId: job?.data.clientId,
    auditType: job?.data.auditType,
    error,
    attemptsMade: job?.attemptsMade,
    attemptsTotal: job?.opts.attempts
  }, 'Job failed');
});

// Create the worker
let worker: Worker<AuditJobData> | null = null;

export async function setupQueue(): Promise<void> {
  logger.info('Setting up BullMQ queue and worker');

  try {
    // Create worker
    worker = new Worker<AuditJobData>('audit-queue', processAuditJob, {
      connection: redis,
      concurrency: 5, // Process up to 5 jobs concurrently
      limiter: {
        max: 10,    // Maximum 10 jobs
        duration: 60000, // Per minute
      },
    });

    // Worker event listeners
    worker.on('ready', () => {
      logger.info('Worker is ready to process jobs');
    });

    worker.on('error', (error) => {
      logger.error({ error }, 'Worker error');
    });

    worker.on('stalled', (jobId) => {
      logger.warn({ jobId }, 'Job stalled');
    });

    worker.on('progress', (job, progress) => {
      logger.debug({ 
        jobId: job.id, 
        progress,
        clientId: job.data.clientId,
        auditType: job.data.auditType
      }, 'Job progress updated');
    });

    // Test Redis connection
    await redis.ping();
    logger.info('Redis connection established');

    // Clean up old jobs on startup
    await cleanupOldJobs();

    logger.info('BullMQ queue and worker setup completed');

  } catch (error) {
    logger.error({ error }, 'Failed to setup queue');
    throw error;
  }
}

export async function shutdownQueue(): Promise<void> {
  logger.info('Shutting down queue and worker');

  try {
    if (worker) {
      await worker.close();
      logger.info('Worker closed');
    }

    await auditQueue.close();
    logger.info('Queue closed');

    await redis.disconnect();
    logger.info('Redis connection closed');

  } catch (error) {
    logger.error({ error }, 'Error during queue shutdown');
  }
}

export async function addAuditJob(
  clientId: string,
  auditType: string,
  runId: string,
  options: {
    priority?: number;
    delay?: number;
    metadata?: Record<string, any>;
  } = {}
): Promise<Job<AuditJobData>> {
  const jobData: AuditJobData = {
    clientId,
    auditType,
    runId,
    priority: options.priority,
    metadata: options.metadata,
  };

  const job = await auditQueue.add('audit', jobData, {
    priority: options.priority,
    delay: options.delay,
    jobId: `${clientId}-${auditType}-${runId}`, // Prevent duplicate jobs
  });

  logger.info({ 
    jobId: job.id,
    clientId,
    auditType,
    runId,
    priority: options.priority
  }, 'Audit job added to queue');

  return job;
}

export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    auditQueue.getWaiting(),
    auditQueue.getActive(),
    auditQueue.getCompleted(),
    auditQueue.getFailed(),
    auditQueue.getDelayed(),
  ]);

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
  };
}

export async function getJobStatus(jobId: string): Promise<{
  status: string;
  progress?: number;
  data?: AuditJobData;
  error?: string;
} | null> {
  try {
    const job = await Job.fromId(auditQueue, jobId);
    if (!job) return null;

    const state = await job.getState();
    
    return {
      status: state,
      progress: typeof job.progress === 'number' ? job.progress : 0,
      data: job.data,
      error: job.failedReason,
    };
  } catch (error) {
    logger.error({ error, jobId }, 'Failed to get job status');
    return null;
  }
}

async function cleanupOldJobs(): Promise<void> {
  try {
    // Clean up completed jobs older than 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    await auditQueue.clean(sevenDaysAgo, 0, 'completed');
    
    // Clean up failed jobs older than 3 days
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    await auditQueue.clean(threeDaysAgo, 0, 'failed');

    logger.info('Old jobs cleaned up');
  } catch (error) {
    logger.error({ error }, 'Failed to clean up old jobs');
  }
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await shutdownQueue();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await shutdownQueue();
  process.exit(0);
});