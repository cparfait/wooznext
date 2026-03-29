import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const counter = await prisma.counter.findUnique({
      where: { id },
      select: { id: true, agentId: true, serviceId: true },
    });

    if (!counter) {
      return NextResponse.json({ error: 'Guichet introuvable' }, { status: 404 });
    }

    // Agent-admin can only release counters from their own service
    if (session.user.role === 'AGENT' && counter.serviceId !== session.user.serviceId) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
    }

    if (!counter.agentId) {
      return NextResponse.json({ error: 'Guichet deja libre' }, { status: 400 });
    }

    // Force disconnect the agent's socket sessions
    const io = (global as any).io;
    if (io) {
      const sockets = await io.fetchSockets();
      for (const s of sockets) {
        if ((s as any).agentId === counter.agentId) {
          s.emit('agent:force-disconnect');
          s.disconnect(true);
        }
      }
    }

    // Release the counter
    await prisma.counter.update({
      where: { id },
      data: { agentId: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error releasing counter:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
