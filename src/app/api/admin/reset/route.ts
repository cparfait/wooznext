import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { TicketStatus } from '@prisma/client';

export async function POST() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    // Cancel all waiting tickets and mark serving as no-show
    await prisma.$transaction([
      prisma.ticket.updateMany({
        where: { status: TicketStatus.WAITING },
        data: { status: TicketStatus.CANCELLED },
      }),
      prisma.ticket.updateMany({
        where: { status: TicketStatus.SERVING },
        data: { status: TicketStatus.NO_SHOW, completedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resetting queue:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
