import { NextRequest, NextResponse } from 'next/server';
import { getDisplayData } from '@/lib/services/ticket.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const data = await getDisplayData(serviceId);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching display data:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données d\'affichage' },
      { status: 500 }
    );
  }
}
