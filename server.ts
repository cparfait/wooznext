import { createServer, IncomingMessage } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { getToken } from 'next-auth/jwt';
import { setSocketIO } from './src/lib/socket-server';
import { startScheduler } from './src/lib/scheduler';
import { validateEnv } from './src/lib/env-validation';

validateEnv();

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();

const MAX_CONNECTIONS_PER_IP = 20;

const ipConnectionCount = new Map<string, number>();

const CUID_REGEX = /^c[a-z0-9]{20,30}$/;

function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const name = pair.slice(0, idx).trim();
    if (!name) continue;
    const value = pair.slice(idx + 1).trim();
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

function parseUrl(url: string) {
  const parsed = new URL(url, 'http://localhost');
  const query: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return { pathname: parsed.pathname, query };
}

function gracefulShutdown(httpServer: ReturnType<typeof createServer>, io: SocketIOServer) {
  console.log('[Shutdown] Graceful shutdown initiated...');

  io.disconnectSockets(true);
  console.log('[Shutdown] All socket connections closed');

  io.close();

  httpServer.close(() => {
    console.log('[Shutdown] HTTP server closed');
    prisma.$disconnect().then(() => {
      console.log('[Shutdown] Prisma disconnected');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('[Shutdown] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parseUrl(req.url!);
    handle(req, res, parsedUrl as any);
  });

  const io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    addTrailingSlash: false,
    cors: {
      origin: dev ? '*' : (process.env.NEXTAUTH_URL || false),
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 1e6,
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  setSocketIO(io);

  io.use((socket, next) => {
    const ip = socket.handshake.headers['x-forwarded-for']
      ?.toString()
      .split(',')[0]
      ?.trim()
      ?? socket.handshake.address;

    const current = ipConnectionCount.get(ip) ?? 0;
    if (current >= MAX_CONNECTIONS_PER_IP) {
      console.warn(`[Socket.IO] Connection limit reached for IP: ${ip}`);
      next(new Error('Too many connections'));
      return;
    }
    ipConnectionCount.set(ip, current + 1);

    (socket as any).clientIp = ip;

    socket.on('disconnect', () => {
      const count = ipConnectionCount.get(ip) ?? 1;
      if (count <= 1) {
        ipConnectionCount.delete(ip);
      } else {
        ipConnectionCount.set(ip, count - 1);
      }
    });

    next();
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('join:service', (serviceId: unknown) => {
      if (typeof serviceId !== 'string' || !CUID_REGEX.test(serviceId)) {
        console.warn(`[Socket.IO] Invalid serviceId from ${socket.id}: ${serviceId}`);
        return;
      }
      socket.join(`service:${serviceId}`);
    });

    socket.on('join:ticket', (ticketId: unknown) => {
      if (typeof ticketId !== 'string' || !CUID_REGEX.test(ticketId)) {
        console.warn(`[Socket.IO] Invalid ticketId from ${socket.id}: ${ticketId}`);
        return;
      }
      socket.join(`ticket:${ticketId}`);
    });

    socket.on('agent:register', async (agentId: unknown) => {
      if (typeof agentId !== 'string' || !CUID_REGEX.test(agentId)) {
        console.warn(`[Socket.IO] Invalid agentId from ${socket.id}: ${agentId}`);
        return;
      }

      // Verify the caller is actually authenticated as this agent by reading
      // the NextAuth JWT from the handshake cookies. Prevents impersonation.
      try {
        const rawCookie = socket.handshake.headers.cookie ?? '';
        const cookies = parseCookieHeader(rawCookie);
        const fakeReq = {
          headers: { cookie: rawCookie },
          cookies,
        } as unknown as IncomingMessage & { cookies: Partial<Record<string, string>> };
        const token = await getToken({
          req: fakeReq,
          secret: process.env.NEXTAUTH_SECRET,
          secureCookie: process.env.NEXTAUTH_URL?.startsWith('https') ?? false,
        });
        if (!token || token.id !== agentId) {
          console.warn(`[Socket.IO] Unauthenticated agent:register from ${socket.id} for ${agentId}`);
          socket.emit('agent:force-disconnect');
          socket.disconnect(true);
          return;
        }
      } catch (err) {
        console.error(`[Socket.IO] Error validating session for ${agentId}:`, err);
        return;
      }

      try {
        const agent = await prisma.agent.findUnique({
          where: { id: agentId },
          select: { id: true, isActive: true },
        });
        if (!agent || !agent.isActive) {
          console.warn(`[Socket.IO] Agent not found or inactive: ${agentId}`);
          return;
        }
      } catch (err) {
        console.error(`[Socket.IO] Error verifying agent ${agentId}:`, err);
        return;
      }

      (socket as any).agentId = agentId;

      const sockets = await io.fetchSockets();
      for (const s of sockets) {
        if (s.id !== socket.id && (s as any).agentId === agentId) {
          s.emit('agent:force-disconnect');
          s.disconnect(true);
        }
      }
    });

    socket.on('disconnect', async () => {
      const agentId = (socket as any).agentId;

      if (agentId) {
        const sockets = await io.fetchSockets();
        const stillConnected = sockets.some(
          (s) => s.id !== socket.id && (s as any).agentId === agentId
        );

        if (!stillConnected) {
          try {
            const result = await prisma.counter.updateMany({
              where: { agentId },
              data: { agentId: null },
            });
            if (result.count > 0) {
              console.log(`[Socket.IO] Released counter for agent ${agentId}`);
            }
          } catch (err) {
            console.error(`[Socket.IO] Error releasing counter for agent ${agentId}:`, err);
          }
        }
      }
    });
  });

  process.on('SIGTERM', () => gracefulShutdown(httpServer, io));
  process.on('SIGINT', () => gracefulShutdown(httpServer, io));

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running on /api/socketio`);
    startScheduler().catch((err) => console.error('[Cron] Failed to start scheduler:', err));
  });
});
