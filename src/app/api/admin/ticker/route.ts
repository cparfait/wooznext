import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, unlink } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { getAdminSession } from '@/lib/api-auth';

const DATA_DIR = path.join(process.cwd(), 'data');
const TICKER_FILE = path.join(DATA_DIR, 'ticker-message.txt');

export async function GET() {
  if (!existsSync(TICKER_FILE)) {
    return NextResponse.json({ message: null });
  }

  const message = (await readFile(TICKER_FILE, 'utf-8')).trim();
  return NextResponse.json({ message: message || null });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const body = await req.json();
  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: 'Message requis' }, { status: 400 });
  }

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  await writeFile(TICKER_FILE, message, 'utf-8');
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (existsSync(TICKER_FILE)) {
    await unlink(TICKER_FILE);
  }

  return NextResponse.json({ success: true });
}
