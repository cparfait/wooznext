import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { getAdminSession } from '@/lib/api-auth';

const LOGO_DIR = path.join(process.cwd(), 'data');
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
// SVG intentionally excluded: SVG files can contain embedded scripts (XSS stored)
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  };
  return map[mimeType] || 'png';
}

/**
 * Verifies the file's magic bytes match the declared MIME type.
 * Prevents spoofed extensions / types (e.g. HTML uploaded as "image/png").
 */
function detectImageFormat(buf: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return 'image/webp';
  }
  return null;
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImageFormat(buffer);
  if (!detected || detected !== file.type) {
    return NextResponse.json(
      { error: 'Le contenu du fichier ne correspond pas a un PNG/JPEG/WebP valide.' },
      { status: 400 }
    );
  }

  // Ensure data directory exists
  if (!existsSync(LOGO_DIR)) {
    mkdirSync(LOGO_DIR, { recursive: true });
  }

  // Remove any existing logo
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const existing = path.join(LOGO_DIR, `logo.${ext}`);
    if (existsSync(existing)) {
      await unlink(existing);
    }
  }

  // Save new logo
  const ext = getExtension(file.type);
  const filePath = path.join(LOGO_DIR, `logo.${ext}`);
  await writeFile(filePath, buffer);

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const existing = path.join(LOGO_DIR, `logo.${ext}`);
    if (existsSync(existing)) {
      await unlink(existing);
    }
  }

  return NextResponse.json({ success: true });
}
