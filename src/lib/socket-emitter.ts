import { getSocketIOOrNull } from './socket-server';

function getIO() {
  return getSocketIOOrNull();
}

/**
 * Emit a queue update event to all clients in a service room.
 * Sent when the queue changes (new ticket, ticket called, completed, etc.)
 */
export function emitQueueUpdate(serviceId: string) {
  const io = getIO();
  if (!io) return;
  io.to(`service:${serviceId}`).emit('queue:updated', { serviceId });
}

/**
 * Emit when a ticket is called by an agent.
 */
export function emitTicketCalled(serviceId: string, ticketId: string, displayCode: string, counterLabel?: string | null) {
  const io = getIO();
  if (!io) return;

  // Notify the service room (agent dashboard + display screen)
  io.to(`service:${serviceId}`).emit('ticket:called', {
    serviceId,
    ticketId,
    displayCode,
    counterLabel: counterLabel ?? null,
  });

  // Notify the specific ticket room (visitor mobile)
  io.to(`ticket:${ticketId}`).emit('ticket:called', {
    ticketId,
    displayCode,
    counterLabel: counterLabel ?? null,
  });
}

/**
 * Emit when a ticket is completed.
 */
export function emitTicketCompleted(serviceId: string, ticketId: string) {
  const io = getIO();
  if (!io) return;

  io.to(`service:${serviceId}`).emit('ticket:completed', {
    serviceId,
    ticketId,
  });

  io.to(`ticket:${ticketId}`).emit('ticket:completed', {
    ticketId,
  });
}

/**
 * Emit when a ticket is returned to the queue.
 */
export function emitTicketReturned(serviceId: string, ticketId: string) {
  const io = getIO();
  if (!io) return;

  io.to(`service:${serviceId}`).emit('queue:updated', { serviceId });
  io.to(`ticket:${ticketId}`).emit('ticket:returned', { ticketId });
}

/**
 * Emit when a ticket is marked as no-show.
 */
export function emitTicketNoShow(serviceId: string, ticketId: string) {
  const io = getIO();
  if (!io) return;

  io.to(`service:${serviceId}`).emit('queue:updated', { serviceId });
  io.to(`ticket:${ticketId}`).emit('ticket:no-show', { ticketId });
}
