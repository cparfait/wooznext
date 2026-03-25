import { NextRequest, NextResponse } from 'next/server';
import { getDisplayData } from '@/lib/services/ticket.service';

export async function GET(
  req: NextRequest,
  { params }: { params: { serviceId: string } }
) {
  try {
    const data = await getDisplayData(params.serviceId);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching display data:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données d\'affichage' },
      { status: 500 }
    );
  }
}
