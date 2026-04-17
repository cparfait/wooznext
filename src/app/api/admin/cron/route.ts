import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { reloadScheduler, runJobNow, ensureJobs } from '@/lib/scheduler';

const JOB_LABELS: Record<string, string> = {
  midnight_cleanup: 'Nettoyage minuit',
  rgpd_purge: 'Purge RGPD (30 jours)',
};

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    await ensureJobs();
    const jobs = await prisma.cronJob.findMany({ orderBy: { name: 'asc' } });
    const result = jobs.map((j) => ({
      ...j,
      label: JOB_LABELS[j.name] || j.name,
    }));

    return NextResponse.json({ jobs: result });
  } catch (error) {
    console.error('Error fetching cron jobs:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

const updateJobSchema = z.object({
  name: z.string(),
  schedule: z.string().refine((v) => cron.validate(v), 'Expression cron invalide'),
  enabled: z.boolean(),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { name, schedule, enabled } = parsed.data;

    await prisma.cronJob.update({
      where: { name },
      data: { schedule, enabled },
    });

    await reloadScheduler();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating cron job:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Nom de tache requis' }, { status: 400 });
    }

    const job = await prisma.cronJob.findUnique({ where: { name } });
    if (!job) {
      return NextResponse.json({ error: 'Tache introuvable' }, { status: 404 });
    }

    const result = await runJobNow(name);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error running cron job:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
