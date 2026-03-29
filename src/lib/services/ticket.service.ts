import { prisma } from '@/lib/prisma';
import { TicketStatus } from '@prisma/client';
import { formatTicketNumber, hashPhone } from '@/lib/utils';

/**
 * Find an active ticket (WAITING or SERVING) for a given phone number.
 */
export async function findActiveTicketByPhone(phone: string) {
  const phoneHash = hashPhone(phone);
  return prisma.ticket.findFirst({
    where: {
      visitor: { phone: phoneHash },
      status: { in: [TicketStatus.WAITING, TicketStatus.SERVING] },
    },
    include: {
      service: true,
      visitor: true,
    },
  });
}

/**
 * Get the next ticket number for a service on a given day.
 * Uses an atomic transaction to prevent race conditions.
 */
async function getNextTicketNumber(serviceId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sequence = await prisma.dailySequence.upsert({
    where: {
      serviceId_date: {
        serviceId,
        date: today,
      },
    },
    create: {
      serviceId,
      date: today,
      lastNumber: 1,
    },
    update: {
      lastNumber: { increment: 1 },
    },
  });

  return sequence.lastNumber;
}

/**
 * Create a new ticket for a visitor.
 * Anti-duplicate: if the phone already has an active ticket, return it.
 */
export async function createTicket(phone: string, serviceId: string) {
  // Check for existing active ticket
  const existing = await findActiveTicketByPhone(phone);
  if (existing) {
    return { ticket: existing, isExisting: true };
  }

  // Get or create visitor (phone stored as hash for RGPD compliance)
  const phoneHash = hashPhone(phone);
  const visitor = await prisma.visitor.upsert({
    where: { phone: phoneHash },
    create: { phone: phoneHash },
    update: {},
  });

  // Get service for prefix
  const service = await prisma.service.findUniqueOrThrow({
    where: { id: serviceId },
  });

  // Get next number atomically
  const number = await getNextTicketNumber(serviceId);
  const displayCode = formatTicketNumber(number, service.prefix || undefined);

  // Create ticket
  const ticket = await prisma.ticket.create({
    data: {
      number,
      displayCode,
      serviceId,
      visitorId: visitor.id,
    },
    include: {
      service: true,
      visitor: true,
    },
  });

  return { ticket, isExisting: false };
}

/**
 * Get a ticket by ID with all relations.
 */
export async function getTicketById(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: {
      service: true,
      visitor: true,
      calledBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

/**
 * Get the position of a WAITING ticket in its service queue.
 */
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

/**
 * Call the next waiting ticket for a service.
 */
export async function callNextTicket(serviceId: string, agentId: string) {
  const nextTicket = await prisma.ticket.findFirst({
    where: {
      serviceId,
      status: TicketStatus.WAITING,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!nextTicket) return null;

  const counter = await prisma.counter.findFirst({
    where: { agentId },
    select: { label: true },
  });

  return prisma.ticket.update({
    where: { id: nextTicket.id },
    data: {
      status: TicketStatus.SERVING,
      calledById: agentId,
      calledAt: new Date(),
      calledFromCounterLabel: counter?.label ?? null,
    },
    include: {
      service: true,
      visitor: true,
    },
  });
}

/**
 * Call a specific ticket by ID.
 */
export async function callTicketById(ticketId: string, agentId: string) {
  const counter = await prisma.counter.findFirst({
    where: { agentId },
    select: { label: true },
  });

  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: TicketStatus.SERVING,
      calledById: agentId,
      calledAt: new Date(),
      calledFromCounterLabel: counter?.label ?? null,
    },
    include: {
      service: true,
      visitor: true,
    },
  });
}

/**
 * Mark a ticket as completed.
 */
export async function completeTicket(ticketId: string) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: TicketStatus.COMPLETED,
      completedAt: new Date(),
    },
    include: {
      service: true,
      visitor: true,
    },
  });
}

/**
 * Return a ticket to the waiting queue (back to WAITING).
 */
export async function returnTicketToQueue(ticketId: string) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: TicketStatus.WAITING,
      calledById: null,
      calledAt: null,
    },
    include: {
      service: true,
      visitor: true,
    },
  });
}

/**
 * Mark a ticket as no-show.
 */
export async function markNoShow(ticketId: string) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: TicketStatus.NO_SHOW,
      completedAt: new Date(),
    },
    include: {
      service: true,
      visitor: true,
    },
  });
}

/**
 * Get queue stats for a service, scoped to a specific agent.
 */
export async function getQueueStats(serviceId: string, agentId?: string) {
  const [waitingCount, currentTicket, waitingTickets] = await Promise.all([
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
      include: { visitor: true },
    }),
    prisma.ticket.findMany({
      where: { serviceId, status: TicketStatus.WAITING },
      orderBy: { createdAt: 'asc' },
      include: { visitor: true },
    }),
  ]);

  return {
    waitingCount,
    currentTicket,
    waitingTickets,
    nextTicket: waitingTickets[0] ?? null,
  };
}

/**
 * Get display data for a service (public screen).
 */
export async function getDisplayData(serviceId: string) {
  const [servingTickets, waitingTickets] = await Promise.all([
    prisma.ticket.findMany({
      where: { serviceId, status: TicketStatus.SERVING },
      orderBy: { calledAt: 'desc' },
      take: 8,
    }),
    prisma.ticket.findMany({
      where: { serviceId, status: TicketStatus.WAITING },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const currentTicket = servingTickets[0] ?? null;

  // Les 2 tickets precedemment appeles (indices 1 et 2 dans les tickets en service,
  // completes par les derniers tickets termines si necessaire)
  type PreviousTicket = { displayCode: string; counterLabel: string | null };
  const previousTickets: PreviousTicket[] = servingTickets.slice(1, 3).map((t) => ({
    displayCode: t.displayCode,
    counterLabel: t.calledFromCounterLabel ?? null,
  }));

  if (previousTickets.length < 2) {
    const needed = 2 - previousTickets.length;
    const lastDone = await prisma.ticket.findMany({
      where: { serviceId, status: { in: [TicketStatus.COMPLETED, TicketStatus.NO_SHOW] } },
      orderBy: { completedAt: 'desc' },
      take: needed,
    });
    for (const t of lastDone) {
      previousTickets.push({ displayCode: t.displayCode, counterLabel: t.calledFromCounterLabel ?? null });
    }
  }

  return {
    currentCode: currentTicket?.displayCode ?? null,
    currentCounter: currentTicket?.calledFromCounterLabel ?? null,
    previousTickets,
    waitingCount: waitingTickets.length,
    servingTickets: servingTickets.map((t) => ({
      displayCode: t.displayCode,
      counterLabel: t.calledFromCounterLabel ?? null,
      calledAt: t.calledAt?.toISOString() ?? null,
    })),
  };
}
