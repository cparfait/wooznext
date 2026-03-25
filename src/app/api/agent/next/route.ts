import { NextResponse } from 'next/server';
import { getAgentSession } from '@/lib/api-auth';
import { callNextTicket } from '@/lib/services/ticket.service';
import { emitTicketCalled, emitQueueUpdate } from '@/lib/socket-emitter';

export async function POST() {
  try {
    const session = await getAgentSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { serviceId } = session.user;
    if (!serviceId) {
      return NextResponse.json(
        { error: 'Aucun service assigné' },
        { status: 400 }
      );
    }

    const ticket = await callNextTicket(serviceId, session.user.id);

    if (!ticket) {
      return NextResponse.json(
        { error: 'Aucun visiteur en attente' },
        { status: 404 }
      );
    }

    emitTicketCalled(serviceId, ticket.id, ticket.displayCode);
    emitQueueUpdate(serviceId);

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Error calling next ticket:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'appel du visiteur suivant' },
      { status: 500 }
    );
  }
}
