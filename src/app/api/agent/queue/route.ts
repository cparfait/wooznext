import { NextResponse } from 'next/server';
import { getAgentSession } from '@/lib/api-auth';
import { getQueueStats } from '@/lib/services/ticket.service';

export async function GET() {
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

    const stats = await getQueueStats(serviceId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching queue stats:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la file' },
      { status: 500 }
    );
  }
}
