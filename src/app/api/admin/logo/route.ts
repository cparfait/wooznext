import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { getAdminSession } from '@/lib/api-auth';

const LOGO_DIR = path.join(process.cwd(), 'data');
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  };
  return map[mimeType] || 'png';
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('logo') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Aucun fichier envoye' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Format non supporte. Utilisez PNG, JPG, SVG ou WebP.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'Fichier trop volumineux (max 2 Mo)' },
      { status: 400 }
    );
  }

  // Ensure data directory exists
  if (!existsSync(LOGO_DIR)) {
    mkdirSync(LOGO_DIR, { recursive: true });
  }

  // Remove any existing logo
  for (const ext of ['png', 'jpg', 'jpeg', 'svg', 'webp']) {
    const existing = path.join(LOGO_DIR, `logo.${ext}`);
    if (existsSync(existing)) {
      await unlink(existing);
    }
  }

  // Save new logo
  const ext = getExtension(file.type);
  const filePath = path.join(LOGO_DIR, `logo.${ext}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  for (const ext of ['png', 'jpg', 'jpeg', 'svg', 'webp']) {
    const existing = path.join(LOGO_DIR, `logo.${ext}`);
    if (existsSync(existing)) {
      await unlink(existing);
    }
  }

  return NextResponse.json({ success: true });
}
