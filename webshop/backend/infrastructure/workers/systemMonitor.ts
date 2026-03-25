// @ts-nocheck
import { prisma } from '../../server';
import { Logger } from '../../middleware/logger';
import os from 'os';

// ─── V42: SYSTEM OPS MONITORING ───────────────
export function runSystemMonitor() {
  setInterval(async () => {
    try {
      const cpus = os.cpus();
      const cpuUsage = cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return acc + (1 - idle / total);
      }, 0) / cpus.length;
      
      const ramTotal = os.totalmem() / 1024 / 1024;
      const ramUsed = (os.totalmem() - os.freemem()) / 1024 / 1024;
      const queueLength = await prisma.backgroundJob.count({ where: { status: 'pending' } });
      
      await prisma.systemMetric.create({
        data: { cpuUsage: parseFloat(cpuUsage.toFixed(4)), ramUsed, ramTotal, queueLength }
      });

      if (cpuUsage > 0.9) {
        Logger.warn('SYSTEM_MONITOR', 'cpu.high', { cpuUsage, ramUsedMb: Math.round(ramUsed) })
      }
      if (queueLength > 50) {
        Logger.warn('SYSTEM_MONITOR', 'job_queue.backlog', { queueLength })
      }
    } catch (e) {
      Logger.error('SYSTEM_MONITOR', 'metric.save.failed', {}, e)
    }
  }, 60000 * 5);
}
