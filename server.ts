import { createServer } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();

function parseUrl(url: string) {
  const parsed = new URL(url, 'http://localhost');
  const query: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return { pathname: parsed.pathname, query };
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parseUrl(req.url!);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    addTrailingSlash: false,
    cors: {
      origin: dev ? '*' : undefined,
    },
  });

  // Store io instance globally so API routes can access it
  (global as any).io = io;

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join a service room to receive targeted updates
    socket.on('join:service', (serviceId: string) => {
      socket.join(`service:${serviceId}`);
      console.log(`[Socket.IO] ${socket.id} joined service:${serviceId}`);
    });

    // Join a ticket room to receive updates for a specific ticket
    socket.on('join:ticket', (ticketId: string) => {
      socket.join(`ticket:${ticketId}`);
      console.log(`[Socket.IO] ${socket.id} joined ticket:${ticketId}`);
    });

    // Agent registers their ID so we can release their counter on disconnect
    // Also disconnects any previous sessions for this agent (single session enforcement)
    socket.on('agent:register', async (agentId: string) => {
      (socket as any).agentId = agentId;
      console.log(`[Socket.IO] Agent ${agentId} registered on ${socket.id}`);

      // Disconnect other sockets for this agent (single session)
      const sockets = await io.fetchSockets();
      for (const s of sockets) {
        if (s.id !== socket.id && (s as any).agentId === agentId) {
          console.log(`[Socket.IO] Disconnecting previous session ${s.id} for agent ${agentId}`);
          s.emit('agent:force-disconnect');
          s.disconnect(true);
        }
      }
    });

    socket.on('disconnect', async () => {
      const agentId = (socket as any).agentId;
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);

      if (agentId) {
        // Check if this agent still has other active sockets (multiple tabs)
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

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running on /api/socketio`);
  });
});
