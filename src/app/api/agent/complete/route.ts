import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAgentSession } from '@/lib/api-auth';
import { completeTicket } from '@/lib/services/ticket.service';

const completeSchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID requis'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAgentSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = completeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const ticket = await completeTicket(parsed.data.ticketId);

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Error completing ticket:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la complétion du ticket' },
      { status: 500 }
    );
  }
}
