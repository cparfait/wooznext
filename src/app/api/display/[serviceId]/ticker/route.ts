import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { serviceId: string } }
) {
  try {
    const service = await prisma.service.findUnique({
      where: { id: params.serviceId },
      select: { tickerMessage: true },
    });

    return NextResponse.json({ message: service?.tickerMessage ?? null });
  } catch {
    return NextResponse.json({ message: null });
  }
}
