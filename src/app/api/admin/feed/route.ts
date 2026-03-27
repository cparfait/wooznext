import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, unlink } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { getAdminSession } from '@/lib/api-auth';

const DATA_DIR = path.join(process.cwd(), 'data');
const FEED_FILE = path.join(DATA_DIR, 'feed-url.txt');

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (!existsSync(FEED_FILE)) {
    return NextResponse.json({ url: null });
  }

  const url = (await readFile(FEED_FILE, 'utf-8')).trim();
  return NextResponse.json({ url: url || null });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const body = await req.json();
  const url = body.url?.trim();

  if (!url) {
    return NextResponse.json({ error: 'URL requise' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'URL invalide' }, { status: 400 });
  }

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  await writeFile(FEED_FILE, url, 'utf-8');
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (existsSync(FEED_FILE)) {
    await unlink(FEED_FILE);
  }

  return NextResponse.json({ success: true });
}
