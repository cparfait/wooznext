import { NextRequest, NextResponse } from 'next/server';
import { getAgentSession } from '@/lib/api-auth';
import { callTicketById } from '@/lib/services/ticket.service';

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

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Error calling ticket:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'appel du visiteur' },
      { status: 500 }
    );
  }
}
