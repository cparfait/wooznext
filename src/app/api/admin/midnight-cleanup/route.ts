import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { TicketStatus } from '@prisma/client';

export async function POST() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const now = new Date();

    // Close WAITING tickets as CANCELLED
    const cancelledResult = await prisma.ticket.updateMany({
      where: { status: TicketStatus.WAITING },
      data: {
        status: TicketStatus.CANCELLED,
        completedAt: now,
      },
    });

    // Close SERVING tickets as NO_SHOW
    const noShowResult = await prisma.ticket.updateMany({
      where: { status: TicketStatus.SERVING },
      data: {
        status: TicketStatus.NO_SHOW,
        completedAt: now,
      },
    });

    // Clear currentTicketId on all counters
    const clearedCounters = await prisma.counter.updateMany({
      where: { currentTicketId: { not: null } },
      data: { currentTicketId: null },
    });

    const total = cancelledResult.count + noShowResult.count;

    return NextResponse.json({
      success: true,
      cancelled: cancelledResult.count,
      noShow: noShowResult.count,
      countersCleared: clearedCounters.count,
      total,
    });
  } catch (error) {
    console.error('Error in midnight cleanup:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
