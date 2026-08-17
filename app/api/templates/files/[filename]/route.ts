import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const sanitized = path.basename(filename);
    const filePath = path.join(process.cwd(), 'data', 'uploads', 'templates', sanitized);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ ok: false, error: 'Archivo no encontrado.' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = sanitized.split('.').pop()?.toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (ext === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === 'doc') contentType = 'application/msword';
    else if (['png', 'jpg', 'jpeg'].includes(ext || '')) contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    else if (ext === 'txt') contentType = 'text/plain; charset=utf-8';

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${sanitized}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('[templates/files] Error:', error);
    return NextResponse.json({ ok: false, error: 'Error al servir archivo.' }, { status: 500 });
  }
}
