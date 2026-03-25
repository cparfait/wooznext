import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { TicketStatus } from '@prisma/client';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalToday,
      completedToday,
      noShowToday,
      waitingNow,
      servingNow,
      avgServiceTime,
    ] = await Promise.all([
      prisma.ticket.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.ticket.count({
        where: { status: TicketStatus.COMPLETED, completedAt: { gte: today } },
      }),
      prisma.ticket.count({
        where: { status: TicketStatus.NO_SHOW, completedAt: { gte: today } },
      }),
      prisma.ticket.count({
        where: { status: TicketStatus.WAITING },
      }),
      prisma.ticket.count({
        where: { status: TicketStatus.SERVING },
      }),
      // Average service time (called_at to completed_at) for today
      prisma.ticket.findMany({
        where: {
          status: TicketStatus.COMPLETED,
          calledAt: { not: null },
          completedAt: { gte: today },
        },
        select: { calledAt: true, completedAt: true },
      }),
    ]);

    // Calculate average service time in seconds
    let avgSeconds = 0;
    if (avgServiceTime.length > 0) {
      const totalSeconds = avgServiceTime.reduce((sum, t) => {
        if (t.calledAt && t.completedAt) {
          return sum + (t.completedAt.getTime() - t.calledAt.getTime()) / 1000;
        }
        return sum;
      }, 0);
      avgSeconds = Math.round(totalSeconds / avgServiceTime.length);
    }

    // Per-service stats
    const services = await prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        tickets: {
          where: { createdAt: { gte: today } },
          select: { status: true },
        },
      },
    });

    const perService = services.map((s) => ({
      id: s.id,
      name: s.name,
      total: s.tickets.length,
      completed: s.tickets.filter((t) => t.status === TicketStatus.COMPLETED).length,
      waiting: s.tickets.filter((t) => t.status === TicketStatus.WAITING).length,
    }));

    return NextResponse.json({
      totalToday,
      completedToday,
      noShowToday,
      waitingNow,
      servingNow,
      avgServiceTimeSeconds: avgSeconds,
      perService,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
