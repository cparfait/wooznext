import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAgentSession } from '@/lib/api-auth';
import { markNoShow } from '@/lib/services/ticket.service';
import { emitTicketNoShow } from '@/lib/socket-emitter';

const noShowSchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID requis'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAgentSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = noShowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const ticket = await markNoShow(parsed.data.ticketId);

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket introuvable ou pas en cours de service' },
        { status: 404 }
      );
    }

    if (ticket.serviceId !== session.user.serviceId) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
    }

    emitTicketNoShow(ticket.serviceId, ticket.id);

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Error marking no-show:', error);
    return NextResponse.json(
      { error: 'Erreur lors du marquage absent' },
      { status: 500 }
    );
  }
}
