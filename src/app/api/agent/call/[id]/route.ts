import { NextRequest, NextResponse } from 'next/server';
import { getAgentSession } from '@/lib/api-auth';
import { callTicketById } from '@/lib/services/ticket.service';
import { emitTicketCalled, emitQueueUpdate } from '@/lib/socket-emitter';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAgentSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const ticket = await callTicketById(params.id, session.user.id);

    const counter = await prisma.counter.findFirst({
      where: { agentId: session.user.id },
      select: { label: true },
    });

    emitTicketCalled(ticket.serviceId, ticket.id, ticket.displayCode, counter?.label);
    emitQueueUpdate(ticket.serviceId);

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Error calling ticket:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'appel du visiteur' },
      { status: 500 }
    );
  }
}
