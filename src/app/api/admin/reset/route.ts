import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/api-auth';
import { TicketStatus } from '@prisma/client';
import { auditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const serviceId = body.serviceId as string | undefined;

    // If agent role, they can only reset their own service
    if (session.user.role === 'AGENT') {
      if (!serviceId || serviceId !== session.user.serviceId) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
      }
    }

    const where = serviceId ? { serviceId } : {};

    // Cancel all waiting tickets and mark serving as no-show
    await prisma.$transaction([
      prisma.ticket.updateMany({
        where: { status: TicketStatus.WAITING, ...where },
        data: { status: TicketStatus.CANCELLED },
      }),
      prisma.ticket.updateMany({
        where: { status: TicketStatus.SERVING, ...where },
        data: { status: TicketStatus.NO_SHOW, completedAt: new Date() },
      }),
    ]);

    auditLog('QUEUE_RESET', { actorId: session.user.id, role: session.user.role, serviceId: serviceId ?? null });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resetting queue:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
