import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';

function formatFirstName(s: string): string {
  return s.replace(/([^\s-]+)/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const updateAgentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'AGENT']).optional(),
  serviceId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json();
    const parsed = updateAgentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { password, firstName, lastName, ...data } = parsed.data;
    const updateData: any = { ...data };
    if (firstName) updateData.firstName = formatFirstName(firstName.trim());
    if (lastName) updateData.lastName = lastName.trim().toUpperCase();

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    const agent = await prisma.agent.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
    });

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    // Check if agent has active tickets (SERVING)
    const servingCount = await prisma.ticket.count({
      where: { calledById: params.id, status: 'SERVING' },
    });
    if (servingCount > 0) {
      return NextResponse.json(
        { error: 'Cet agent a des tickets en cours. Terminez-les d\'abord.' },
        { status: 400 }
      );
    }

    // Unassign from counters first
    await prisma.counter.updateMany({
      where: { agentId: params.id },
      data: { agentId: null },
    });

    await prisma.agent.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
