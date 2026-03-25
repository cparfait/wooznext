import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url') || process.env.NEXTAUTH_URL || 'http://localhost:3000';

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
