import { Server as SocketIOServer } from 'socket.io';

const GLOBAL_KEY = '__wooznext_socketio__' as const;

declare global {
  // eslint-disable-next-line no-var
  var __wooznext_socketio__: SocketIOServer | undefined;
}

export function setSocketIO(server: SocketIOServer): void {
  globalThis[GLOBAL_KEY] = server;
}

export function getSocketIO(): SocketIOServer {
  const instance = globalThis[GLOBAL_KEY];
  if (!instance) throw new Error('Socket.IO not initialized');
  return instance;
}

export function getSocketIOOrNull(): SocketIOServer | null {
  return globalThis[GLOBAL_KEY] ?? null;
}

/** Room joined by authenticated admin views to receive presence updates. */
export const ADMIN_ROOM = 'admin';

/** Ids of agents whose agent dashboard is currently connected (set on `agent:register`). */
export function getOnlineAgentIds(): Set<string> {
  const ids = new Set<string>();
  const io = getSocketIOOrNull();
  if (!io) return ids;
  for (const socket of io.of('/').sockets.values()) {
    const agentId = (socket as any).agentId;
    if (typeof agentId === 'string') ids.add(agentId);
  }
  return ids;
}

/** True when at least one client follows the ticket (visitor tracking page open). */
export function isTicketFollowed(ticketId: string): boolean {
  const io = getSocketIOOrNull();
  return (io?.of('/').adapter.rooms.get(`ticket:${ticketId}`)?.size ?? 0) > 0;
}
