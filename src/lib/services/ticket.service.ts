import { prisma } from '@/lib/prisma';
import { TicketStatus } from '@prisma/client';
import { formatTicketNumber, hashPhone } from '@/lib/utils';

export async function findActiveTicketByPhone(phone: string) {
  const phoneHash = hashPhone(phone);
  return prisma.ticket.findFirst({
    where: {
      visitor: { phone: phoneHash },
      status: { in: [TicketStatus.WAITING, TicketStatus.SERVING] },
    },
    select: {
      id: true,
      number: true,
      displayCode: true,
      status: true,
      serviceId: true,
      visitorId: true,
      createdAt: true,
      calledAt: true,
      completedAt: true,
      calledById: true,
      calledFromCounterLabel: true,
      service: { select: { id: true, name: true, prefix: true, isActive: true } },
      visitor: { select: { id: true, phone: true } },
      calledBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function createTicket(phone: string, serviceId: string) {
  return prisma.$transaction(async (tx) => {
    const phoneHash = hashPhone(phone);

    const existing = await tx.ticket.findFirst({
      where: {
        visitor: { phone: phoneHash },
        status: { in: [TicketStatus.WAITING, TicketStatus.SERVING] },
      },
      select: {
        id: true,
        number: true,
        displayCode: true,
        status: true,
        serviceId: true,
        visitorId: true,
        createdAt: true,
        calledAt: true,
        completedAt: true,
        calledById: true,
        calledFromCounterLabel: true,
        service: { select: { id: true, name: true, prefix: true, isActive: true } },
        visitor: { select: { id: true, phone: true } },
      },
    });
    if (existing) {
      return { ticket: existing, isExisting: true };
    }

    const visitor = await tx.visitor.upsert({
      where: { phone: phoneHash },
      create: { phone: phoneHash },
      update: {},
    });

    const service = await tx.service.findUniqueOrThrow({
      where: { id: serviceId },
      select: { prefix: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sequence = await tx.dailySequence.upsert({
      where: { serviceId_date: { serviceId, date: today } },
      create: { serviceId, date: today, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });

    const number = sequence.lastNumber;
    const displayCode = formatTicketNumber(number, service.prefix || undefined);

    const ticket = await tx.ticket.create({
      data: {
        number,
        displayCode,
        serviceId,
        visitorId: visitor.id,
      },
      select: {
        id: true,
        number: true,
        displayCode: true,
        status: true,
        serviceId: true,
        visitorId: true,
        createdAt: true,
        calledAt: true,
        completedAt: true,
        calledById: true,
        calledFromCounterLabel: true,
        service: { select: { id: true, name: true, prefix: true, isActive: true } },
        visitor: { select: { id: true, phone: true } },
      },
    });

    return { ticket, isExisting: false };
  });
}

export async function getTicketById(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      displayCode: true,
      status: true,
      serviceId: true,
      visitorId: true,
      createdAt: true,
      calledAt: true,
      completedAt: true,
      calledById: true,
      calledFromCounterLabel: true,
      service: { select: { id: true, name: true, prefix: true, isActive: true } },
      visitor: { select: { id: true, phone: true } },
      calledBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getTicketPosition(ticketId: string): Promise<number> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { serviceId: true, createdAt: true, status: true },
  });

  if (!ticket || ticket.status !== TicketStatus.WAITING) return 0;

  const ahead = await prisma.ticket.count({
    where: {
      serviceId: ticket.serviceId,
      status: TicketStatus.WAITING,
      createdAt: { lt: ticket.createdAt },
    },
  });

  return ahead + 1;
}

const TICKET_SELECT = {
  id: true,
  number: true,
  displayCode: true,
  status: true,
  serviceId: true,
  visitorId: true,
  createdAt: true,
  calledAt: true,
  completedAt: true,
  calledById: true,
  calledFromCounterLabel: true,
  returnedToQueue: true,
  returnReason: true,
  service: { select: { id: true, name: true, prefix: true, isActive: true } },
  visitor: { select: { id: true, phone: true } },
};

async function autoCompleteServingTickets(tx: any, agentId: string) {
  const previouslyServing = await tx.ticket.findMany({
    where: { calledById: agentId, status: TicketStatus.SERVING },
    select: { id: true, serviceId: true },
  });

  if (previouslyServing.length > 0) {
    await tx.ticket.updateMany({
      where: { calledById: agentId, status: TicketStatus.SERVING },
      data: { status: TicketStatus.COMPLETED, completedAt: new Date() },
    });
  }

  return previouslyServing;
}

export async function callNextTicket(serviceId: string, agentId: string) {
  return prisma.$transaction(async (tx) => {
    const completedTickets = await autoCompleteServingTickets(tx, agentId);

    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tickets
      WHERE service_id = ${serviceId} AND status = 'WAITING'
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    if (rows.length === 0) {
      return completedTickets.length > 0 ? { ticket: null, completedTickets } : null;
    }

    const counter = await tx.counter.findFirst({
      where: { agentId },
      select: { label: true },
    });

    const ticket = await tx.ticket.update({
      where: { id: rows[0].id },
      data: {
        status: TicketStatus.SERVING,
        calledById: agentId,
        calledAt: new Date(),
        calledFromCounterLabel: counter?.label ?? null,
        returnedToQueue: false,
      },
      select: TICKET_SELECT,
    });

    return { ticket, completedTickets };
  });
}

type TicketWithRelations = {
  id: string;
  number: number;
  displayCode: string;
  status: TicketStatus;
  serviceId: string;
  visitorId: string;
  createdAt: Date;
  calledAt: Date | null;
  completedAt: Date | null;
  calledById: string | null;
  calledFromCounterLabel: string | null;
  returnedToQueue: boolean;
  returnReason: string | null;
  service: { id: string; name: string; prefix: string; isActive: boolean };
  visitor: { id: string; phone: string };
};

type CallResult =
  | null
  | 'FORBIDDEN'
  | { ticket: TicketWithRelations; completedTickets: { id: string; serviceId: string }[] }
  | { ticket: null; completedTickets: { id: string; serviceId: string }[] };

export async function callTicketById(ticketId: string, agentId: string, agentServiceId: string): Promise<CallResult> {
  return prisma.$transaction(async (tx) => {
    const completedTickets = await autoCompleteServingTickets(tx, agentId);

    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: { status: true, serviceId: true },
    });

    if (!ticket || ticket.status !== TicketStatus.WAITING) {
      return completedTickets.length > 0 ? { ticket: null, completedTickets } : null;
    }
    if (ticket.serviceId !== agentServiceId) {
      return completedTickets.length > 0 ? ({ ticket: null, completedTickets, forbidden: true } as CallResult) : 'FORBIDDEN';
    }

    const counter = await tx.counter.findFirst({
      where: { agentId },
      select: { label: true },
    });

    const newTicket = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.SERVING,
        calledById: agentId,
        calledAt: new Date(),
        calledFromCounterLabel: counter?.label ?? null,
        returnedToQueue: false,
      },
      select: TICKET_SELECT,
    });

    return { ticket: newTicket, completedTickets };
  });
}

export async function completeTicket(ticketId: string) {
  try {
    return await prisma.ticket.update({
      where: { id: ticketId, status: TicketStatus.SERVING },
      data: {
        status: TicketStatus.COMPLETED,
        completedAt: new Date(),
      },
      select: {
        id: true,
        number: true,
        displayCode: true,
        status: true,
        serviceId: true,
        visitorId: true,
        createdAt: true,
        calledAt: true,
        completedAt: true,
        calledById: true,
        calledFromCounterLabel: true,
        service: { select: { id: true, name: true, prefix: true, isActive: true } },
        visitor: { select: { id: true, phone: true } },
      },
    });
  } catch {
    return null;
  }
}

export async function returnTicketToQueue(ticketId: string, reason?: string) {
  try {
    return await prisma.ticket.update({
      where: { id: ticketId, status: TicketStatus.SERVING },
      data: {
        status: TicketStatus.WAITING,
        calledById: null,
        calledAt: null,
        returnedToQueue: true,
        returnReason: reason ?? null,
      },
      select: {
        id: true,
        number: true,
        displayCode: true,
        status: true,
        serviceId: true,
        visitorId: true,
        createdAt: true,
        calledAt: true,
        completedAt: true,
        calledById: true,
        calledFromCounterLabel: true,
        service: { select: { id: true, name: true, prefix: true, isActive: true } },
        visitor: { select: { id: true, phone: true } },
      },
    });
  } catch {
    return null;
  }
}

export async function markNoShow(ticketId: string) {
  try {
    return await prisma.ticket.update({
      where: { id: ticketId, status: TicketStatus.SERVING },
      data: {
        status: TicketStatus.NO_SHOW,
        completedAt: new Date(),
      },
      select: {
        id: true,
        number: true,
        displayCode: true,
        status: true,
        serviceId: true,
        visitorId: true,
        createdAt: true,
        calledAt: true,
        completedAt: true,
        calledById: true,
        calledFromCounterLabel: true,
        service: { select: { id: true, name: true, prefix: true, isActive: true } },
        visitor: { select: { id: true, phone: true } },
      },
    });
  } catch {
    return null;
  }
}

export async function getQueueStats(serviceId: string, agentId?: string) {
  const [waitingCount, currentTicket, waitingTickets, returnedTickets] = await Promise.all([
    prisma.ticket.count({
      where: { serviceId, status: TicketStatus.WAITING },
    }),
    prisma.ticket.findFirst({
      where: {
        serviceId,
        status: TicketStatus.SERVING,
        ...(agentId ? { calledById: agentId } : {}),
      },
      orderBy: { calledAt: 'desc' },
      select: {
        id: true,
        number: true,
        displayCode: true,
        status: true,
        serviceId: true,
        visitorId: true,
        createdAt: true,
        calledAt: true,
        completedAt: true,
        calledById: true,
        calledFromCounterLabel: true,
        returnedToQueue: true,
        returnReason: true,
        visitor: { select: { id: true, phone: true } },
      },
    }),
    prisma.ticket.findMany({
      where: { serviceId, status: TicketStatus.WAITING, returnedToQueue: false },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        number: true,
        displayCode: true,
        status: true,
        serviceId: true,
        visitorId: true,
        createdAt: true,
        returnedToQueue: true,
        returnReason: true,
        visitor: { select: { id: true, phone: true } },
      },
    }),
    prisma.ticket.findMany({
      where: { serviceId, status: TicketStatus.WAITING, returnedToQueue: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        number: true,
        displayCode: true,
        status: true,
        serviceId: true,
        visitorId: true,
        createdAt: true,
        returnedToQueue: true,
        returnReason: true,
        visitor: { select: { id: true, phone: true } },
      },
    }),
  ]);

  return {
    waitingCount,
    currentTicket,
    waitingTickets,
    returnedTickets,
    nextTicket: waitingTickets[0] ?? null,
  };
}

export async function getDisplayData(serviceId: string) {
  const [servingTickets, waitingCount, previousFromCompleted] = await Promise.all([
    prisma.ticket.findMany({
      where: { serviceId, status: TicketStatus.SERVING },
      orderBy: { calledAt: 'desc' },
      take: 8,
      select: {
        displayCode: true,
        calledFromCounterLabel: true,
        calledAt: true,
        returnedToQueue: true,
        returnReason: true,
      },
    }),
    prisma.ticket.count({
      where: { serviceId, status: TicketStatus.WAITING },
    }),
    prisma.ticket.findMany({
      where: { serviceId, status: { in: [TicketStatus.COMPLETED, TicketStatus.NO_SHOW] } },
      orderBy: { completedAt: 'desc' },
      take: 3,
      select: {
        displayCode: true,
        calledFromCounterLabel: true,
      },
    }),
  ]);

  const currentTicket = servingTickets[0] ?? null;

  type PreviousTicket = { displayCode: string; counterLabel: string | null };
  const previousTickets: PreviousTicket[] = servingTickets.slice(1, 4).map((t) => ({
    displayCode: t.displayCode,
    counterLabel: t.calledFromCounterLabel ?? null,
  }));

  if (previousTickets.length < 3) {
    const needed = 3 - previousTickets.length;
    for (let i = 0; i < needed && i < previousFromCompleted.length; i++) {
      previousTickets.push({
        displayCode: previousFromCompleted[i].displayCode,
        counterLabel: previousFromCompleted[i].calledFromCounterLabel ?? null,
      });
    }
  }

  return {
    currentCode: currentTicket?.displayCode ?? null,
    currentCounter: currentTicket?.calledFromCounterLabel ?? null,
    currentReturnReason: currentTicket?.returnedToQueue ? (currentTicket.returnReason ?? null) : null,
    previousTickets,
    waitingCount,
    servingTickets: servingTickets.map((t) => ({
      displayCode: t.displayCode,
      counterLabel: t.calledFromCounterLabel ?? null,
      calledAt: t.calledAt?.toISOString() ?? null,
      returnReason: t.returnedToQueue ? (t.returnReason ?? null) : null,
    })),
  };
}
