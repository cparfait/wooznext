import { NextResponse } from 'next/server';
import { getAgentSession } from '@/lib/api-auth';
import { getQueueStats } from '@/lib/services/ticket.service';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getAgentSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { serviceId, id: agentId } = session.user;
    if (!serviceId) {
      return NextResponse.json(
        { error: 'Aucun service assigné' },
        { status: 400 }
      );
    }

    const [stats, counter] = await Promise.all([
      getQueueStats(serviceId),
      prisma.counter.findFirst({
        where: { agentId },
        select: { label: true },
      }),
    ]);

    return NextResponse.json({ ...stats, counterLabel: counter?.label ?? null });
  } catch (error) {
    console.error('Error fetching queue stats:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la file' },
      { status: 500 }
    );
  }
}
