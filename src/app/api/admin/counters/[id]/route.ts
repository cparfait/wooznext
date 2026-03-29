import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';

const updateCounterSchema = z.object({
  label: z.string().min(1, 'Label requis'),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const body = await req.json();
    const parsed = updateCounterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const counter = await prisma.counter.update({
      where: { id },
      data: { label: parsed.data.label },
      include: {
        agent: { select: { id: true, firstName: true, lastName: true } },
        currentTicket: { select: { id: true, displayCode: true } },
      },
    });

    return NextResponse.json({ counter });
  } catch (error) {
    console.error('Error updating counter:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    // Check if counter has a current ticket being served
    const counter = await prisma.counter.findUnique({
      where: { id },
      select: { currentTicketId: true },
    });

    if (!counter) {
      return NextResponse.json({ error: 'Guichet introuvable' }, { status: 404 });
    }

    if (counter.currentTicketId) {
      return NextResponse.json(
        { error: 'Impossible de supprimer un guichet avec un ticket en cours de traitement.' },
        { status: 409 }
      );
    }

    await prisma.counter.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting counter:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
