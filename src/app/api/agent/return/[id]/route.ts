import { NextRequest, NextResponse } from 'next/server';
import { getAgentSession } from '@/lib/api-auth';
import { returnTicketToQueue } from '@/lib/services/ticket.service';
import { emitTicketReturned } from '@/lib/socket-emitter';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAgentSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const ticket = await returnTicketToQueue(params.id);

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
