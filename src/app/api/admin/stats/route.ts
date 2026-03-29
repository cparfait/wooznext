import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { TicketStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || undefined;

    // AGENT role is scoped to their own service only
    const serviceId =
      session.user.role === 'AGENT'
        ? (session.user.serviceId ?? undefined)
        : (searchParams.get('serviceId') || undefined);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    // Date range
    let dateFrom: Date;
    let dateTo: Date;

    if (fromParam) {
      dateFrom = new Date(fromParam);
      dateFrom.setHours(0, 0, 0, 0);
    } else {
      dateFrom = new Date();
      dateFrom.setHours(0, 0, 0, 0);
    }

    if (toParam) {
      dateTo = new Date(toParam);
      dateTo.setHours(23, 59, 59, 999);
    } else {
      dateTo = new Date();
      dateTo.setHours(23, 59, 59, 999);
    }

    const dateFilter = { gte: dateFrom, lte: dateTo };

    const [
      totalToday,
      completedToday,
      noShowToday,
      waitingNow,
      servingNow,
      avgServiceTime,
    ] = await Promise.all([
      prisma.ticket.count({
        where: {
          createdAt: dateFilter,
          ...(serviceId ? { serviceId } : {}),
          ...(agentId ? { calledById: agentId } : {}),
        },
      }),
      prisma.ticket.count({
        where: {
          status: TicketStatus.COMPLETED,
          completedAt: dateFilter,
          ...(serviceId ? { serviceId } : {}),
          ...(agentId ? { calledById: agentId } : {}),
        },
      }),
      prisma.ticket.count({
        where: {
          status: TicketStatus.NO_SHOW,
          completedAt: dateFilter,
          ...(serviceId ? { serviceId } : {}),
          ...(agentId ? { calledById: agentId } : {}),
        },
      }),
      prisma.ticket.count({
        where: {
          status: TicketStatus.WAITING,
          ...(serviceId ? { serviceId } : {}),
        },
      }),
      prisma.ticket.count({
        where: {
          status: TicketStatus.SERVING,
          ...(serviceId ? { serviceId } : {}),
          ...(agentId ? { calledById: agentId } : {}),
        },
      }),
      prisma.ticket.findMany({
        where: {
          status: TicketStatus.COMPLETED,
          calledAt: { not: null },
          completedAt: dateFilter,
          ...(serviceId ? { serviceId } : {}),
          ...(agentId ? { calledById: agentId } : {}),
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
      where: { isActive: true, ...(serviceId ? { id: serviceId } : {}) },
      select: {
        id: true,
        name: true,
        tickets: {
          where: {
            createdAt: dateFilter,
            ...(agentId ? { calledById: agentId } : {}),
          },
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

    // Per-agent stats
    const agentTickets = await prisma.ticket.findMany({
      where: {
        completedAt: dateFilter,
        status: { in: [TicketStatus.COMPLETED, TicketStatus.NO_SHOW] },
        calledById: agentId ? agentId : { not: null },
        ...(serviceId ? { serviceId } : {}),
      },
      select: {
        status: true,
        calledAt: true,
        completedAt: true,
        calledById: true,
        calledBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Group by agent
    const agentMap = new Map<string, {
      id: string;
      firstName: string;
      lastName: string;
      completed: number;
      noShow: number;
      totalServiceSeconds: number;
      completedWithTime: number;
    }>();

    for (const t of agentTickets) {
      if (!t.calledById || !t.calledBy) continue;
      let entry = agentMap.get(t.calledById);
      if (!entry) {
        entry = {
          id: t.calledBy.id,
          firstName: t.calledBy.firstName,
          lastName: t.calledBy.lastName,
          completed: 0,
          noShow: 0,
          totalServiceSeconds: 0,
          completedWithTime: 0,
        };
        agentMap.set(t.calledById, entry);
      }

      if (t.status === TicketStatus.COMPLETED) {
        entry.completed++;
        if (t.calledAt && t.completedAt) {
          entry.totalServiceSeconds += (t.completedAt.getTime() - t.calledAt.getTime()) / 1000;
          entry.completedWithTime++;
        }
      } else if (t.status === TicketStatus.NO_SHOW) {
        entry.noShow++;
      }
    }

    const perAgent = Array.from(agentMap.values()).map((a) => ({
      id: a.id,
      name: `${a.firstName} ${a.lastName}`,
      completed: a.completed,
      noShow: a.noShow,
      avgServiceTimeSeconds: a.completedWithTime > 0
        ? Math.round(a.totalServiceSeconds / a.completedWithTime)
        : 0,
    }));

    return NextResponse.json({
      totalToday,
      completedToday,
      noShowToday,
      waitingNow,
      servingNow,
      avgServiceTimeSeconds: avgSeconds,
      perService,
      perAgent,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
