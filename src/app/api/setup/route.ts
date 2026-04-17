import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const adminCount = await prisma.agent.count({
      where: { role: 'ADMIN', isAnonymized: false },
    });
    return NextResponse.json({ needsSetup: adminCount === 0 });
  } catch (error) {
    console.error('Error checking setup status:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

const setupSchema = z.object({
  firstName: z.string().min(1, 'Prenom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  password: z
    .string()
    .min(12, 'Mot de passe trop court (min 12 caracteres)')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[0-9]/, 'Au moins un chiffre')
    .regex(/[^A-Za-z0-9]/, 'Au moins un caractere special'),
  serviceName: z.string().min(1, 'Nom du service requis'),
  servicePrefix: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const adminCount = await prisma.agent.count({
      where: { role: 'ADMIN', isAnonymized: false },
    });
    if (adminCount > 0) {
      return NextResponse.json({ error: 'Installation deja effectuee' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { firstName, lastName, email, password, serviceName, servicePrefix } = parsed.data;

    const service = await prisma.service.create({
      data: {
        name: serviceName.trim(),
        prefix: servicePrefix?.trim() || '',
      },
    });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.agent.create({
      data: {
        firstName: firstName.trim().replace(/([^\s-]+)/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()),
        lastName: lastName.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: 'ADMIN',
        serviceId: service.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Cet email existe deja' }, { status: 409 });
    }
    console.error('Error during setup:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
