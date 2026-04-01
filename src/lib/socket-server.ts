import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setSocketIO(server: SocketIOServer): void {
  io = server;
}

/** Retourne l'instance Socket.IO. Lève une erreur si non initialisée. */
export function getSocketIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

/** Retourne l'instance Socket.IO ou null si non encore initialisée (ex: pendant le build). */
export function getSocketIOOrNull(): SocketIOServer | null {
  return io;
}
