import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { auditLog } from '@/lib/audit';

function formatFirstName(s: string): string {
  return s.replace(/([^\s-]+)/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const passwordSchema = z
  .string()
  .min(12, 'Mot de passe trop court (min 12 caractères)')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
  .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir au moins un caractère spécial');

const updateAgentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: passwordSchema.optional(),
  role: z.enum(['ADMIN', 'AGENT']).optional(),
  serviceId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      where: { id },
      data: updateData,
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
    });

    if (password) {
      auditLog('PASSWORD_CHANGED_ADMIN', { actorId: session.user.id, targetId: id });
    } else {
      auditLog('AGENT_UPDATED', { actorId: session.user.id, targetId: id });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) return NextResponse.json({ error: 'Agent introuvable' }, { status: 404 });
    if (agent.isAnonymized) return NextResponse.json({ error: 'Impossible de supprimer cet agent' }, { status: 400 });
    if (id === session.user.id) return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 });

    const servingCount = await prisma.ticket.count({
      where: { calledById: id, status: 'SERVING' },
    });
    if (servingCount > 0) {
      return NextResponse.json(
        { error: 'Cet agent a des tickets en cours. Terminez-les d\'abord.' },
        { status: 400 }
      );
    }

    const targetServiceId = agent.serviceId;
    if (!targetServiceId) {
      await prisma.counter.updateMany({ where: { agentId: id }, data: { agentId: null } });
      await prisma.agent.delete({ where: { id } });
      auditLog('AGENT_DELETED', { actorId: session.user.id, targetId: id });
      return NextResponse.json({ success: true });
    }

    let anonAgent = await prisma.agent.findFirst({
      where: { serviceId: targetServiceId, isAnonymized: true },
    });

    if (!anonAgent) {
      const service = await prisma.service.findUnique({ where: { id: targetServiceId } });
      const prefix = service?.prefix ?? 'SRV';
      const randomSuffix = crypto.randomBytes(4).toString('hex');
      anonAgent = await prisma.agent.create({
        data: {
          firstName: 'Anciens',
          lastName: `Agents ${prefix}`,
          email: `anonymized-${prefix}-${randomSuffix}@wooz.internal`,
          passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
          role: 'AGENT',
          serviceId: targetServiceId,
          isActive: false,
          isAnonymized: true,
        },
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.ticket.updateMany({
        where: { calledById: id },
        data: { calledById: anonAgent!.id },
      });

      await tx.counter.updateMany({
        where: { agentId: id },
        data: { agentId: null },
      });

      await tx.agent.delete({ where: { id } });
    });

    auditLog('AGENT_DELETED', { actorId: session.user.id, targetId: id, transferredTo: anonAgent.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
