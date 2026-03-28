import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';

const createCounterSchema = z.object({
  label: z.string().min(1, 'Label requis'),
  serviceId: z.string().min(1, 'Service requis'),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get('serviceId');

    const where = serviceId ? { serviceId } : {};

    const counters = await prisma.counter.findMany({
      where,
      orderBy: { label: 'asc' },
      include: {
        agent: { select: { id: true, firstName: true, lastName: true } },
        currentTicket: { select: { id: true, displayCode: true } },
      },
    });

    return NextResponse.json({ counters });
  } catch (error) {
    console.error('Error fetching counters:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const body = await req.json();
    const parsed = createCounterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    // Verify service exists
    const service = await prisma.service.findUnique({
      where: { id: parsed.data.serviceId },
    });
    if (!service) {
      return NextResponse.json({ error: 'Service introuvable' }, { status: 404 });
    }

    const counter = await prisma.counter.create({
      data: {
        label: parsed.data.label,
        serviceId: parsed.data.serviceId,
      },
      include: {
        agent: { select: { id: true, firstName: true, lastName: true } },
        currentTicket: { select: { id: true, displayCode: true } },
      },
    });

    return NextResponse.json({ counter }, { status: 201 });
  } catch (error) {
    console.error('Error creating counter:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
