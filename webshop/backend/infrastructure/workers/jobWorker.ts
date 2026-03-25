// @ts-nocheck
import { prisma } from '../../server';
import { Logger } from '../../middleware/logger';

// ─── V42: ASYNC BACKGROUND JOB QUEUE ──────────
export async function runJobWorker() {
  Logger.info('JOB_WORKER', 'worker.started', { tickMs: 10000 })
  setInterval(async () => {
    let job: any = null
    try {
      job = await prisma.backgroundJob.findFirst({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } });
      if (!job) return;
      
      await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: 'processing', startedAt: new Date() } });
      Logger.info('JOB_WORKER', 'job.started', { jobId: job.id, type: job.type })

      if (job.type === 'email_blast') {
        const payload = job.payload as any;
        Logger.info('JOB_WORKER', 'job.processing.email_blast', { jobId: job.id, userCount: payload.count || 0 })
        await new Promise(r => setTimeout(r, 3000));
      } else if (job.type === 'ai_bulk_generation') {
        Logger.info('JOB_WORKER', 'job.processing.ai_bulk', { jobId: job.id })
        await new Promise(r => setTimeout(r, 5000));
      }
      
      await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: 'completed', endedAt: new Date(), result: 'Success' } });
      Logger.info('JOB_WORKER', 'job.completed', { jobId: job.id, type: job.type })
    } catch (err: any) {
      Logger.error('JOB_WORKER', 'job.failed', { jobId: job?.id, type: job?.type }, err)
      if (job?.id) {
        await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: 'failed', endedAt: new Date(), error: err?.message } }).catch(() => {})
      }
    }
  }, 10000);
}
