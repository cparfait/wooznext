import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
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

    const { password, ...data } = parsed.data;
    const updateData: any = { ...data };

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    const agent = await prisma.agent.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
