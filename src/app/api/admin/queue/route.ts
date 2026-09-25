import { NextResponse } from 'next/server';
import { TicketStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { logErrorWithId } from '@/lib/error-id';
import { getOnlineAgentIds, isTicketFollowed } from '@/lib/socket-server';

/**
 * Vue lecture seule de la file d'attente et des personnes connectees, par service.
 * ADMIN : tous les services actifs. AGENT : uniquement son service.
 *
 * "En ligne" = socket connecte : tableau de bord agent ouvert pour un agent,
 * page de suivi du ticket ouverte pour un visiteur.
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const isFullAdmin = session.user.role === 'ADMIN';
    const scopeServiceId = session.user.serviceId ?? null;

    if (!isFullAdmin && !scopeServiceId) {
      return NextResponse.json({ services: [], summary: { agentsOnline: 0, visitorsOnline: 0, waiting: 0 } });
    }

    const services = await prisma.service.findMany({
      where: { isActive: true, ...(isFullAdmin ? {} : { id: scopeServiceId! }) },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        agents: {
          where: { isActive: true },
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            counters: { select: { label: true }, take: 1 },
          },
        },
        tickets: {
          where: { status: { in: [TicketStatus.WAITING, TicketStatus.SERVING] } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            displayCode: true,
            status: true,
            createdAt: true,
            calledAt: true,
            calledFromCounterLabel: true,
            returnedToQueue: true,
            returnReason: true,
            calledBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const onlineAgentIds = getOnlineAgentIds();

    const result = services.map(({ tickets, agents, ...service }) => ({
      ...service,
      agents: agents
        .map((a) => ({
          id: a.id,
          name: `${a.firstName} ${a.lastName}`,
          online: onlineAgentIds.has(a.id),
          counterLabel: a.counters[0]?.label ?? null,
        }))
        // En ligne d'abord, l'ordre alphabetique est conserve a l'interieur de chaque groupe
        .sort((a, b) => Number(b.online) - Number(a.online)),
      waiting: tickets
        .filter((t) => t.status === TicketStatus.WAITING)
        .map((t) => ({
          id: t.id,
          displayCode: t.displayCode,
          createdAt: t.createdAt,
          returnedToQueue: t.returnedToQueue,
          returnReason: t.returnReason,
          online: isTicketFollowed(t.id),
        })),
      serving: tickets
        .filter((t) => t.status === TicketStatus.SERVING)
        .map((t) => ({
          id: t.id,
          displayCode: t.displayCode,
          calledAt: t.calledAt,
          counterLabel: t.calledFromCounterLabel,
          agentName: t.calledBy ? `${t.calledBy.firstName} ${t.calledBy.lastName}` : null,
          online: isTicketFollowed(t.id),
        })),
    }));

    const scopedAgentIds = new Set(result.flatMap((s) => s.agents.map((a) => a.id)));

    return NextResponse.json({
      services: result,
      summary: {
        // Admin : tous les agents connectes, y compris ceux hors des services listes
        agentsOnline: isFullAdmin
          ? onlineAgentIds.size
          : [...onlineAgentIds].filter((id) => scopedAgentIds.has(id)).length,
        visitorsOnline: result.reduce(
          (sum, s) => sum + s.waiting.filter((t) => t.online).length + s.serving.filter((t) => t.online).length,
          0
        ),
        waiting: result.reduce((sum, s) => sum + s.waiting.length, 0),
      },
    });
  } catch (error) {
    const errorId = logErrorWithId('admin:queue', error);
    return NextResponse.json({ error: 'Erreur serveur', errorId }, { status: 500 });
  }
}
