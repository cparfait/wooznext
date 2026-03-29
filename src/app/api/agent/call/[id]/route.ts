import { NextRequest, NextResponse } from 'next/server';
import { getAgentSession } from '@/lib/api-auth';
import { callTicketById } from '@/lib/services/ticket.service';
import { emitTicketCalled, emitQueueUpdate } from '@/lib/socket-emitter';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAgentSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const ticket = await callTicketById(id, session.user.id);

    emitTicketCalled(ticket.serviceId, ticket.id, ticket.displayCode, ticket.calledFromCounterLabel ?? undefined);
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
