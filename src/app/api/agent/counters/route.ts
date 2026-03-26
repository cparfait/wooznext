import { NextResponse } from 'next/server';
import { getAgentSession } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getAgentSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifie' },
        { status: 401 }
      );
    }

    const { serviceId, id: agentId } = session.user;

    if (!serviceId) {
      return NextResponse.json(
        { error: 'Aucun service assigne' },
        { status: 400 }
      );
    }

    const counters = await prisma.counter.findMany({
      where: {
        serviceId,
        isActive: true,
        OR: [
          { agentId: null },
          { agentId },
        ],
      },
      orderBy: { label: 'asc' },
      select: {
        id: true,
        label: true,
        agentId: true,
      },
    });

    return NextResponse.json({ counters });
  } catch (error) {
    console.error('List counters error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
