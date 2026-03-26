import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { TicketStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId') || undefined;
    const agentId = searchParams.get('agentId') || undefined;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build base filters
    const baseWhere: Record<string, unknown> = { createdAt: { gte: today } };
    if (serviceId) baseWhere.serviceId = serviceId;
    if (agentId) baseWhere.calledById = agentId;

    const [
      totalToday,
      completedToday,
      noShowToday,
      waitingNow,
      servingNow,
      avgServiceTime,
    ] = await Promise.all([
      prisma.ticket.count({
        where: { ...baseWhere },
      }),
      prisma.ticket.count({
        where: {
          status: TicketStatus.COMPLETED,
          completedAt: { gte: today },
          ...(serviceId ? { serviceId } : {}),
          ...(agentId ? { calledById: agentId } : {}),
        },
      }),
      prisma.ticket.count({
        where: {
          status: TicketStatus.NO_SHOW,
          completedAt: { gte: today },
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
      // Average service time: only COMPLETED tickets (exclude NO_SHOW)
      prisma.ticket.findMany({
        where: {
          status: TicketStatus.COMPLETED,
          calledAt: { not: null },
          completedAt: { gte: today },
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
            createdAt: { gte: today },
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
        completedAt: { gte: today },
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
          select: { id: true, name: true },
        },
      },
    });

    // Group by agent
    const agentMap = new Map<string, {
      id: string;
      name: string;
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
          name: t.calledBy.name,
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
      name: a.name,
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
