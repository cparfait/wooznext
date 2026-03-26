import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAgentSession } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

const selectCounterSchema = z.object({
  counterId: z.string().min(1, 'counterId est requis'),
});

export async function POST(request: Request) {
  try {
    const session = await getAgentSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifie' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = selectCounterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { counterId } = parsed.data;
    const { serviceId, id: agentId } = session.user;

    const counter = await prisma.counter.findUnique({
      where: { id: counterId },
    });

    if (!counter) {
      return NextResponse.json(
        { error: 'Guichet introuvable' },
        { status: 404 }
      );
    }

    if (counter.serviceId !== serviceId) {
      return NextResponse.json(
        { error: 'Ce guichet ne fait pas partie de votre service' },
        { status: 403 }
      );
    }

    if (counter.agentId && counter.agentId !== agentId) {
      return NextResponse.json(
        { error: 'Ce guichet est deja occupe par un autre agent' },
        { status: 409 }
      );
    }

    // Release any counter the agent currently occupies
    await prisma.counter.updateMany({
      where: { agentId },
      data: { agentId: null },
    });

    // Assign the new counter
    const updated = await prisma.counter.update({
      where: { id: counterId },
      data: { agentId },
      select: {
        id: true,
        label: true,
        serviceId: true,
        agentId: true,
      },
    });

    return NextResponse.json({ counter: updated });
  } catch (error) {
    console.error('Select counter error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await getAgentSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifie' },
        { status: 401 }
      );
    }

    const { id: agentId } = session.user;

    const result = await prisma.counter.updateMany({
      where: { agentId },
      data: { agentId: null },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Aucun guichet assigne' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Guichet libere' });
  } catch (error) {
    console.error('Release counter error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
