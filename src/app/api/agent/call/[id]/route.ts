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

    const result = await callTicketById(id, session.user.id, session.user.serviceId!);

    if (result === 'FORBIDDEN') {
      return NextResponse.json(
        { error: 'Ce ticket n\'appartient pas a votre service' },
        { status: 403 }
      );
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Ticket introuvable ou deja appele' },
        { status: 404 }
      );
    }

    if (!result.ticket) {
      return NextResponse.json({ completedTickets: result.completedTickets });
    }

    emitTicketCalled(result.ticket.serviceId, result.ticket.id, result.ticket.displayCode, result.ticket.calledFromCounterLabel ?? undefined, result.ticket.returnReason ?? undefined);
    emitQueueUpdate(result.ticket.serviceId);

    return NextResponse.json({ ticket: result.ticket });
  } catch (error) {
    console.error('Error calling ticket:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'appel du visiteur' },
      { status: 500 }
    );
  }
}
