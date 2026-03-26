import { createServer } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

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

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running on /api/socketio`);
  });
});
