'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

let globalSocket: Socket | null = null;
let forceDisconnectCallback: (() => void) | null = null;

/**
 * Register a callback to be called when the server forces disconnect.
 */
export function onForceDisconnect(callback: () => void) {
  forceDisconnectCallback = callback;
}

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
    globalSocket.on('agent:force-disconnect', () => {
      if (forceDisconnectCallback) forceDisconnectCallback();
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

    function joinAndRegister() {
      socket.emit('join:service', serviceId);
      if (agentId) {
        socket.emit('agent:register', agentId);
      }
    }

    // Join on first connect and on every reconnect
    joinAndRegister();
    socket.on('connect', joinAndRegister);

    const events = ['queue:updated', 'ticket:called', 'ticket:completed', 'ticker:updated', 'feed:updated'];
    const handler = (event: string) => (data: any) => {
      onEventRef.current(event, data);
    };

    const handlers = events.map((event) => {
      const h = handler(event);
      socket.on(event, h);
      return { event, handler: h };
    });

    return () => {
      socket.off('connect', joinAndRegister);
      handlers.forEach(({ event, handler: h }) => socket.off(event, h));
    };
  }, [serviceId, agentId]);
}

/**
 * Hook to join several service rooms at once (read-only supervision, e.g. admin queue view).
 * Calls onEvent when a queue-related event is received for any of the services.
 */
export function useServicesSocket(
  serviceIds: string[],
  onEvent: (event: string, data: any) => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Stable dependency: only re-subscribe when the set of services actually changes
  const key = serviceIds.join(',');

  useEffect(() => {
    if (!key) return;
    const ids = key.split(',');

    const socket = getSocket();

    function joinAll() {
      ids.forEach((id) => socket.emit('join:service', id));
    }

    joinAll();
    socket.on('connect', joinAll);

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
      socket.off('connect', joinAll);
      handlers.forEach(({ event, handler: h }) => socket.off(event, h));
    };
  }, [key]);
}

/**
 * Hook to join the admin room (session checked server-side).
 * Calls onPresence when an agent or a visitor connects / disconnects.
 */
export function useAdminPresenceSocket(onPresence: () => void) {
  const onPresenceRef = useRef(onPresence);
  onPresenceRef.current = onPresence;

  useEffect(() => {
    const socket = getSocket();

    function joinAdmin() {
      socket.emit('join:admin');
    }

    joinAdmin();
    socket.on('connect', joinAdmin);

    const handler = () => onPresenceRef.current();
    socket.on('presence:updated', handler);

    return () => {
      socket.off('connect', joinAdmin);
      socket.off('presence:updated', handler);
    };
  }, []);
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

    function joinTicket() {
      socket.emit('join:ticket', ticketId);
    }

    // Join on first connect and on every reconnect
    joinTicket();
    socket.on('connect', joinTicket);

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
      socket.off('connect', joinTicket);
      handlers.forEach(({ event, handler: h }) => socket.off(event, h));
    };
  }, [ticketId]);
}
