import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';

const updateServiceSchema = z.object({
  name: z.string().min(1).optional(),
  prefix: z.string().max(5).optional(),
  isActive: z.boolean().optional(),
  feedUrl: z.string().url().nullable().optional(),
  feedActive: z.boolean().optional(),
  tickerMessage: z.string().nullable().optional(),
  tickerActive: z.boolean().optional(),
  tickerPosition: z.enum(['top', 'middle', 'bottom']).optional(),
  tickerHeight: z.number().int().min(30).max(120).optional(),
  tickerBgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  tickerTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  tickerFontSize: z.number().int().min(12).max(60).optional(),
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
    const parsed = updateServiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const service = await prisma.service.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ service });
  } catch (error) {
    console.error('Error updating service:', error);
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

    // Check for active tickets (WAITING or SERVING)
    const activeTickets = await prisma.ticket.count({
      where: {
        serviceId: id,
        status: { in: ['WAITING', 'SERVING'] },
      },
    });

    if (activeTickets > 0) {
      return NextResponse.json(
        { error: 'Ce service a des tickets actifs. Annulez-les d\'abord.' },
        { status: 400 }
      );
    }

    // Actually delete the service (cascade handles related records)
    await prisma.service.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
