import { NextRequest, NextResponse } from 'next/server';
import { getAgentSession } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { emitTicketCalled, emitQueueUpdate } from '@/lib/socket-emitter';

export async function POST(req: NextRequest) {
  try {
    const session = await getAgentSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const body = await req.json();
    const ticketId = body.ticketId;
    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId requis' }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, displayCode: true, serviceId: true, status: true },
    });

    if (!ticket || ticket.status !== 'SERVING') {
      return NextResponse.json({ error: 'Ticket non valide' }, { status: 400 });
    }

    // Re-emit the called event to trigger display flash + visitor notification
    emitTicketCalled(ticket.serviceId, ticket.id, ticket.displayCode);
    emitQueueUpdate(ticket.serviceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recalling ticket:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
