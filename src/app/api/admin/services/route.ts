import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';

const createServiceSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  prefix: z.string().max(5).default(''),
});

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const services = await prisma.service.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { agents: true, counters: true } },
      },
    });

    return NextResponse.json({ services });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json();
    const parsed = createServiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const service = await prisma.service.create({ data: parsed.data });
    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
