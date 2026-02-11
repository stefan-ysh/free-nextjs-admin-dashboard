import fs from 'node:fs/promises';
import { NextResponse } from 'next/server';
import mime from 'mime';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { buildAbsolutePathFromSegments } from '@/lib/storage/local';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ segments: string[] }> }
) {
  try {
    await requireCurrentUser();
  } catch {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { segments } = await params;
  const absolutePath = buildAbsolutePathFromSegments(segments);

  if (!absolutePath) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const file = await fs.readFile(absolutePath);
    const mimeType = mime.getType(absolutePath) || 'application/octet-stream';
    return new NextResponse(file, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    console.error('读取本地文件失败:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
