import { NextRequest, NextResponse } from 'next/server';
import { getTicketById, getTicketPosition } from '@/lib/services/ticket.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticket = await getTicketById(id);

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket non trouvé' },
        { status: 404 }
      );
    }

    const position = await getTicketPosition(ticket.id);

    return NextResponse.json({ ticket, position });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du ticket' },
      { status: 500 }
    );
  }
}
