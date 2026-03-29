import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';

/** Capitalize first letter of each part (separated by - or space) */
function formatFirstName(s: string): string {
  return s.replace(/([^\s-]+)/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const passwordSchema = z
  .string()
  .min(12, 'Mot de passe trop court (min 12 caractères)')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
  .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir au moins un caractère spécial');

const createAgentSchema = z.object({
  firstName: z.string().min(1, 'Prenom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  password: passwordSchema,
  role: z.enum(['ADMIN', 'AGENT']).default('AGENT'),
  serviceId: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const agents = await prisma.agent.findMany({
      orderBy: { lastName: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        serviceId: true,
        service: { select: { name: true } },
        createdAt: true,
      },
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json();
    const parsed = createAgentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { password, firstName, lastName, ...data } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);

    const agent = await prisma.agent.create({
      data: {
        ...data,
        firstName: formatFirstName(firstName.trim()),
        lastName: lastName.trim().toUpperCase(),
        passwordHash,
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Cet email existe deja' }, { status: 409 });
    }
    console.error('Error creating agent:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
