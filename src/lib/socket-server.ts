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
