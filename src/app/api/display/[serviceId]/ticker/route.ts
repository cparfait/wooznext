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
      select: {
        tickerMessage: true,
        tickerActive: true,
        tickerPosition: true,
        tickerHeight: true,
        tickerBgColor: true,
        tickerTextColor: true,
        tickerFontSize: true,
      },
    });

    return NextResponse.json({
      message: (service?.tickerActive !== false ? service?.tickerMessage : null) ?? null,
      position: service?.tickerPosition ?? 'bottom',
      height: service?.tickerHeight ?? 48,
      bgColor: service?.tickerBgColor ?? '#dc2626',
      textColor: service?.tickerTextColor ?? '#ffffff',
      fontSize: service?.tickerFontSize ?? 18,
    });
  } catch {
    return NextResponse.json({ message: null });
  }
}
