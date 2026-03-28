'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

let globalSocket: Socket | null = null;

function getSocket(): Socket {
  if (!globalSocket) {
    globalSocket = io({
      path: '/api/socketio',
      addTrailingSlash: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return globalSocket;
}

/**
 * Hook to connect to Socket.IO and join a service room.
 * Calls onEvent when any of the specified events are received.
 * If agentId is provided, registers the agent for presence tracking.
 */
export function useServiceSocket(
  serviceId: string | null,
  onEvent: (event: string, data: any) => void,
  agentId?: string | null
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!serviceId) return;

    const socket = getSocket();
    socket.emit('join:service', serviceId);

    if (agentId) {
      socket.emit('agent:register', agentId);
    }

    const events = ['queue:updated', 'ticket:called', 'ticket:completed'];
    const handler = (event: string) => (data: any) => {
      onEventRef.current(event, data);
    };

    const handlers = events.map((event) => {
      const h = handler(event);
      socket.on(event, h);
      return { event, handler: h };
    });

    return () => {
      handlers.forEach(({ event, handler: h }) => socket.off(event, h));
    };
  }, [serviceId, agentId]);
}

/**
 * Hook to connect to Socket.IO and join a ticket room.
 * Calls onEvent when the ticket status changes.
 */
export function useTicketSocket(
  ticketId: string | null,
  onEvent: (event: string, data: any) => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!ticketId) return;

    const socket = getSocket();
    socket.emit('join:ticket', ticketId);

    const events = ['ticket:called', 'ticket:completed', 'ticket:returned', 'ticket:no-show'];
    const handler = (event: string) => (data: any) => {
      onEventRef.current(event, data);
    };

    const handlers = events.map((event) => {
      const h = handler(event);
      socket.on(event, h);
      return { event, handler: h };
    });

    return () => {
      handlers.forEach(({ event, handler: h }) => socket.off(event, h));
    };
  }, [ticketId]);
}
