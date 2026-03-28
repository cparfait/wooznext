import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const LOGO_DIR = path.join(process.cwd(), 'data');

export async function GET() {
  // Try common extensions
  for (const ext of ['png', 'jpg', 'jpeg', 'svg', 'webp']) {
    const filePath = path.join(LOGO_DIR, `logo.${ext}`);
    if (existsSync(filePath)) {
      const buffer = await readFile(filePath);
      const contentType =
        ext === 'svg' ? 'image/svg+xml' :
        ext === 'png' ? 'image/png' :
        ext === 'webp' ? 'image/webp' :
        'image/jpeg';
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        },
      });
    }
  }
  return NextResponse.json({ error: 'No logo found' }, { status: 404 });
}
