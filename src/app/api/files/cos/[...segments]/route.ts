import { NextResponse } from 'next/server';
import mime from 'mime';
import COS from 'cos-nodejs-sdk-v5';

import { requireCurrentUser } from '@/lib/auth/current-user';

export const runtime = 'nodejs';

function resolveCosConfig() {
  const secretId =
    process.env.COS_SECRET_ID?.trim() ||
    process.env.TENCENT_COS_SECRET_ID?.trim() ||
    process.env.SECRET_ID?.trim() ||
    process.env.SecretId?.trim();
  const secretKey =
    process.env.COS_SECRET_KEY?.trim() ||
    process.env.TENCENT_COS_SECRET_KEY?.trim() ||
    process.env.SECRET_KEY?.trim() ||
    process.env.SecretKey?.trim();
  const bucket = process.env.COS_BUCKET?.trim();
  const region = process.env.COS_REGION?.trim();
  return { secretId, secretKey, bucket, region };
}

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ segments: string[] }> }
) {
  try {
    await requireCurrentUser();
  } catch {
    return unauthorizedResponse();
  }

  const config = resolveCosConfig();
  if (!config.secretId || !config.secretKey || !config.bucket || !config.region) {
    return badRequestResponse('COS 未配置');
  }

  const resolved = await params;
  const key = (resolved.segments ?? [])
    .map((segment) => decodeURIComponent(segment))
    .join('/')
    .replace(/^\/+/, '');

  if (!key) {
    return badRequestResponse('文件路径不能为空');
  }

  try {
    const cos = new COS({
      SecretId: config.secretId,
      SecretKey: config.secretKey,
    });

    const object = await new Promise<{
      body: Buffer;
      contentType?: string;
      contentLength?: string;
      etag?: string;
    }>((resolve, reject) => {
      cos.getObject(
        {
          Bucket: config.bucket!,
          Region: config.region!,
          Key: key,
        },
        (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          const rawBody = data?.Body;
          const bodyBuffer = Buffer.isBuffer(rawBody)
            ? rawBody
            : Buffer.from(typeof rawBody === 'string' ? rawBody : '');
          resolve({
            body: bodyBuffer,
            contentType: data?.headers?.['content-type'],
            contentLength: data?.headers?.['content-length'],
            etag: data?.headers?.etag,
          });
        }
      );
    });

    const guessedType = mime.getType(key) || 'application/octet-stream';
    const contentType = object.contentType || guessedType;

    const searchParams = new URL(request.url).searchParams;
    const fileName = searchParams.get('filename')?.trim();
    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',
    });
    if (object.contentLength) headers.set('Content-Length', object.contentLength);
    if (object.etag) headers.set('ETag', object.etag);
    if (fileName) {
      headers.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    }

    return new NextResponse(object.body, { headers });
  } catch (error) {
    console.error('读取 COS 文件失败:', error);
    return NextResponse.json({ success: false, error: '读取文件失败' }, { status: 404 });
  }
}
