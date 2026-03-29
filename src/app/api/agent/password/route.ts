import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getAgentSession } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
  newPassword: z
    .string()
    .min(12, 'Le nouveau mot de passe doit contenir au moins 12 caracteres')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une lettre majuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
    .regex(
      /[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/~`]/,
      'Le mot de passe doit contenir au moins un caractere special'
    ),
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
    const parsed = passwordSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => e.message);
      return NextResponse.json(
        { error: errors[0], errors },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const agent = await prisma.agent.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent introuvable' },
        { status: 404 }
      );
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, agent.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json(
        { error: 'Le mot de passe actuel est incorrect' },
        { status: 403 }
      );
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await prisma.agent.update({
      where: { id: session.user.id },
      data: { passwordHash: newHash },
    });

    auditLog('PASSWORD_CHANGED_SELF', { actorId: session.user.id, email: session.user.email ?? undefined });
    return NextResponse.json({ success: true, message: 'Mot de passe mis a jour' });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
