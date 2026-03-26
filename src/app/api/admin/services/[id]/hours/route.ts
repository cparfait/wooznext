import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';

const dayHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM attendu'),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM attendu'),
  isClosed: z.boolean(),
});

const updateHoursSchema = z.object({
  hours: z.array(dayHoursSchema).length(7, 'Les 7 jours de la semaine sont requis'),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const serviceId = params.id;

    // Verify service exists
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      return NextResponse.json({ error: 'Service introuvable' }, { status: 404 });
    }

    const existing = await prisma.openingHours.findMany({
      where: { serviceId },
      orderBy: { dayOfWeek: 'asc' },
    });

    // If no hours exist yet, return defaults
    if (existing.length === 0) {
      const defaults = Array.from({ length: 7 }, (_, i) => ({
        dayOfWeek: i,
        openTime: '08:30',
        closeTime: '17:00',
        isClosed: i >= 5,
      }));
      return NextResponse.json({ hours: defaults });
    }

    const hours = existing.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openTime: h.openTime,
      closeTime: h.closeTime,
      isClosed: h.isClosed,
    }));

    return NextResponse.json({ hours });
  } catch (error) {
    console.error('Error fetching opening hours:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const serviceId = params.id;

    // Verify service exists
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      return NextResponse.json({ error: 'Service introuvable' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateHoursSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Upsert all 7 days in a transaction
    await prisma.$transaction(
      parsed.data.hours.map((day) =>
        prisma.openingHours.upsert({
          where: {
            serviceId_dayOfWeek: {
              serviceId,
              dayOfWeek: day.dayOfWeek,
            },
          },
          update: {
            openTime: day.openTime,
            closeTime: day.closeTime,
            isClosed: day.isClosed,
          },
          create: {
            serviceId,
            dayOfWeek: day.dayOfWeek,
            openTime: day.openTime,
            closeTime: day.closeTime,
            isClosed: day.isClosed,
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating opening hours:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
