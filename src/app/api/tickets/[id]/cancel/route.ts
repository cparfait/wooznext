import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitQueueUpdate } from '@/lib/socket-emitter';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      '127.0.0.1';

    if (!checkRateLimit(`cancel:${ip}`, 10, 60_000)) {
      return NextResponse.json(
        { error: 'Trop de demandes. Veuillez patienter.' },
        { status: 429 }
      );
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, status: true, serviceId: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket introuvable' }, { status: 404 });
    }

    if (ticket.status !== 'WAITING') {
      return NextResponse.json(
        { error: 'Seul un ticket en attente peut etre annule' },
        { status: 400 }
      );
    }

    await prisma.ticket.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    emitQueueUpdate(ticket.serviceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling ticket:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
