import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const FEED_FILE = path.join(process.cwd(), 'data', 'feed-url.txt');

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!existsSync(FEED_FILE)) {
    return NextResponse.json({ items: null });
  }

  const url = (await readFile(FEED_FILE, 'utf-8')).trim();
  if (!url) {
    return NextResponse.json({ items: null });
  }

  try {
    const res = await fetch(url, {
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

    // Normalize items — adapt to common French city feed structures
    const items = rawItems.slice(0, 5).map((item: Record<string, unknown>) => ({
      title: item.title ?? item.titre ?? item.name ?? item.nom ?? '',
      date: item.date ?? item.publicationDebut ?? item.published ?? item.pubDate ?? item.created ?? null,
      image: item.image ?? item.imageUrl ?? item.thumbnail ?? item.photo ?? item.visuel ?? null,
      url: item.url ?? item.link ?? item.href ?? null,
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: null });
  }
}
