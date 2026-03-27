import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const serviceId = req.nextUrl.searchParams.get('serviceId');
  if (!serviceId) {
    return NextResponse.json({ items: null });
  }

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { feedUrl: true, feedActive: true },
  });

  if (!service?.feedUrl || !service.feedActive) {
    return NextResponse.json({ items: null });
  }

  try {
    const res = await fetch(service.feedUrl, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json({ items: null });
    }

    const json = await res.json();

    // Support array or object with common keys
    const rawItems = Array.isArray(json)
      ? json
      : json.items ?? json.data ?? json.results ?? json.articles ?? [];

    // Filter active items and normalize
    const items = rawItems
      .filter((item: Record<string, unknown>) => item.etat === undefined || item.etat === 1)
      .slice(0, 5)
      .map((item: Record<string, unknown>) => ({
        title: item.title ?? item.titre ?? item.name ?? item.nom ?? '',
        date: item.date ?? item.publicationDebut ?? item.published ?? item.pubDate ?? item.created ?? null,
        image: item.image ?? item.imageUrl ?? item.thumbnail ?? item.photo ?? item.visuel ?? null,
        url: item.url ?? item.link ?? item.href ?? null,
        content: item.contenu ?? item.content ?? item.description ?? item.summary ?? null,
        category: item.codeActualite ?? item.category ?? item.categorie ?? null,
      }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: null });
  }
}
