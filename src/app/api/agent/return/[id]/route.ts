import { NextRequest, NextResponse } from 'next/server';
import { getAgentSession } from '@/lib/api-auth';
import { returnTicketToQueue } from '@/lib/services/ticket.service';
import { emitTicketReturned } from '@/lib/socket-emitter';

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

    let reason: string | undefined;
    try {
      const body = await req.json();
      reason = body.reason;
    } catch {
      // no body
    }

    const ticket = await returnTicketToQueue(id, reason);

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket introuvable ou pas en cours de service' },
        { status: 404 }
      );
    }

    if (ticket.serviceId !== session.user.serviceId) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
    }

    emitTicketReturned(ticket.serviceId, ticket.id);

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Error returning ticket:', error);
    return NextResponse.json(
      { error: 'Erreur lors du retour en file' },
      { status: 500 }
    );
  }
}
