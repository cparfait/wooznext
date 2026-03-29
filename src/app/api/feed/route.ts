import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Validates that the URL is safe to fetch (SSRF protection).
 * - HTTPS only
 * - Blocks loopback, private IPv4 ranges, link-local, and IPv6 loopback
 */
function isSafeFeedUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  // Loopback and localhost
  if (host === 'localhost' || host === '::1') return false;

  // IPv4 private / reserved ranges
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (
      a === 0 ||          // 0.0.0.0/8
      a === 10 ||         // 10.0.0.0/8
      a === 127 ||        // 127.0.0.0/8 loopback
      (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
      (a === 169 && b === 254) ||           // 169.254.0.0/16 link-local
      (a === 172 && b >= 16 && b <= 31) ||  // 172.16.0.0/12
      (a === 192 && b === 168)              // 192.168.0.0/16
    ) {
      return false;
    }
  }

  // IPv6 private (ULA fc00::/7, link-local fe80::/10)
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
    return false;
  }

  return true;
}

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

  if (!isSafeFeedUrl(service.feedUrl)) {
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
