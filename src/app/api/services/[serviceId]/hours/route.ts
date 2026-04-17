import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      return NextResponse.json({ error: 'Service introuvable' }, { status: 404 });
    }

    const existing = await prisma.openingHours.findMany({
      where: { serviceId },
      orderBy: { dayOfWeek: 'asc' },
    });

    if (existing.length === 0) {
      return NextResponse.json({ hours: [] });
    }

    const hours = existing.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openTime: h.openTime,
      closeTime: h.closeTime,
      openTimePm: h.openTimePm,
      closeTimePm: h.closeTimePm,
      isClosed: h.isClosed,
      isClosedAm: h.isClosedAm,
      isClosedPm: h.isClosedPm,
    }));

    return NextResponse.json({ hours });
  } catch (error) {
    console.error('Error fetching public hours:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
