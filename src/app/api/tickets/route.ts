import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createTicket } from '@/lib/services/ticket.service';

const createTicketSchema = z.object({
  phone: z
    .string()
    .min(10, 'Numéro de téléphone invalide')
    .max(15)
    .regex(/^[0-9+\s-]+$/, 'Format de numéro invalide'),
  serviceId: z.string().min(1, 'Service requis'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createTicketSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { phone, serviceId } = parsed.data;
    const { ticket, isExisting } = await createTicket(phone, serviceId);

    return NextResponse.json(
      { ticket, isExisting },
      { status: isExisting ? 200 : 201 }
    );
  } catch (error) {
    console.error('Error creating ticket:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du ticket' },
      { status: 500 }
    );
  }
}
