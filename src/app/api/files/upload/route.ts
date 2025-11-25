import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { saveUploadedFile } from '@/lib/storage/local';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB，与前端提示一致
const DEFAULT_FOLDER = 'general';
const DEFAULT_PREFIX = 'upload';

export const runtime = 'nodejs';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    await requireCurrentUser();

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'MISSING_FILE' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ success: false, error: 'EMPTY_FILE' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'FILE_TOO_LARGE' }, { status: 400 });
    }

    const folderParam = formData.get('folder');
    const prefixParam = formData.get('prefix');
    const folder = typeof folderParam === 'string' && folderParam.trim().length > 0 ? folderParam : DEFAULT_FOLDER;
    const prefix = typeof prefixParam === 'string' && prefixParam.trim().length > 0 ? prefixParam : DEFAULT_PREFIX;

    const url = await saveUploadedFile(file, folder, prefix);

    return NextResponse.json({
      success: true,
      data: {
        url,
        name: file.name,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return unauthorizedResponse();
      }
      if (error.message === 'FILE_TOO_LARGE') {
        return NextResponse.json({ success: false, error: 'FILE_TOO_LARGE' }, { status: 400 });
      }
      if (error.message === 'UNSUPPORTED_FILE_TYPE') {
        return NextResponse.json({ success: false, error: 'UNSUPPORTED_FILE_TYPE' }, { status: 400 });
      }
    }
    console.error('文件上传失败:', error);
    return NextResponse.json({ success: false, error: 'UPLOAD_FAILED' }, { status: 500 });
  }
}
