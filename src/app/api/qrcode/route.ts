import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const serviceId = req.nextUrl.searchParams.get('serviceId');
    const baseUrl = req.nextUrl.searchParams.get('url') || process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3002}`;

    if (!serviceId) {
      // Sans serviceId, lister les services disponibles
      const services = await prisma.service.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, prefix: true },
      });

      return NextResponse.json({
        message: 'Ajoutez ?serviceId=ID pour generer un QR code',
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          prefix: s.prefix,
          qrUrl: `${baseUrl}/api/qrcode?serviceId=${s.id}`,
        })),
      });
    }

    const url = `${baseUrl}/?service=${serviceId}`;

    const svg = await QRCode.toString(url, {
      type: 'svg',
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml' },
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return NextResponse.json({ error: 'Erreur generation QR code' }, { status: 500 });
  }
}
