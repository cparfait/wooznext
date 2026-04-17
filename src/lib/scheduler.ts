import * as cron from 'node-cron';
import { PrismaClient, TicketStatus } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_JOBS = [
  {
    name: 'midnight_cleanup',
    schedule: '0 0 * * *',
  },
  {
    name: 'rgpd_purge',
    schedule: '0 3 * * *',
  },
];

const activeJobs = new Map<string, cron.ScheduledTask>();

async function ensureJobs() {
  for (const def of DEFAULT_JOBS) {
    await prisma.cronJob.upsert({
      where: { name: def.name },
      update: {},
      create: {
        name: def.name,
        schedule: def.schedule,
        enabled: true,
      },
    });
  }
}

async function runMidnightCleanup(): Promise<string> {
  const now = new Date();
  const cancelled = await prisma.ticket.updateMany({
    where: { status: TicketStatus.WAITING },
    data: { status: TicketStatus.CANCELLED, completedAt: now },
  });
  const noShow = await prisma.ticket.updateMany({
    where: { status: TicketStatus.SERVING },
    data: { status: TicketStatus.NO_SHOW, completedAt: now },
  });
  const cleared = await prisma.counter.updateMany({
    where: { currentTicketId: { not: null } },
    data: { currentTicketId: null },
  });
  return `${cancelled.count} ticket(s) annules, ${noShow.count} absent(s), ${cleared.count} guichet(s) libere(s)`;
}

async function runRgpdPurge(): Promise<string> {
  const RETENTION_DAYS = 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const deletedTickets = await prisma.ticket.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      status: { in: [TicketStatus.COMPLETED, TicketStatus.CANCELLED, TicketStatus.NO_SHOW] },
    },
  });
  const deletedSequences = await prisma.dailySequence.deleteMany({
    where: { date: { lt: cutoff } },
  });
  const deletedVisitors = await prisma.visitor.deleteMany({
    where: {
      tickets: { none: {} },
      createdAt: { lt: cutoff },
    },
  });
  return `${deletedTickets.count} ticket(s), ${deletedSequences.count} sequence(s), ${deletedVisitors.count} visiteur(s) supprimes`;
}

async function executeJob(name: string): Promise<void> {
  const startTime = Date.now();
  let result: string;
  try {
    switch (name) {
      case 'midnight_cleanup':
        result = await runMidnightCleanup();
        break;
      case 'rgpd_purge':
        result = await runRgpdPurge();
        break;
      default:
        result = 'Tache inconnue';
    }
    const duration = Date.now() - startTime;
    await prisma.cronJob.update({
      where: { name },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: 'success',
        lastRunResult: `${result} (${duration}ms)`,
      },
    });
    console.log(`[Cron] ${name}: ${result} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    await prisma.cronJob.update({
      where: { name },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: 'error',
        lastRunResult: error.message?.slice(0, 500) || 'Erreur inconnue',
      },
    });
    console.error(`[Cron] ${name} failed:`, error);
  }
}

function startJob(job: { name: string; schedule: string; enabled: boolean }) {
  if (activeJobs.has(job.name)) {
    activeJobs.get(job.name)!.stop();
    activeJobs.delete(job.name);
  }

  if (!job.enabled) return;
  if (!cron.validate(job.schedule)) {
    console.warn(`[Cron] Invalid schedule for ${job.name}: ${job.schedule}`);
    return;
  }

  const task = cron.schedule(job.schedule, () => executeJob(job.name), {
    timezone: 'Europe/Paris',
  });
  activeJobs.set(job.name, task);
  console.log(`[Cron] ${job.name}: schedule="${job.schedule}" enabled=true`);
}

export async function startScheduler() {
  await ensureJobs();
  const jobs = await prisma.cronJob.findMany();
  for (const job of jobs) {
    startJob(job);
  }
  console.log(`[Cron] ${jobs.length} tache(s) planifiee(s)`);
}

export async function reloadScheduler() {
  for (const [, task] of activeJobs) {
    task.stop();
  }
  activeJobs.clear();
  const jobs = await prisma.cronJob.findMany();
  for (const job of jobs) {
    startJob(job);
  }
}

export async function runJobNow(name: string): Promise<string> {
  await executeJob(name);
  const job = await prisma.cronJob.findUnique({ where: { name } });
  return job?.lastRunResult || 'Termine';
}
