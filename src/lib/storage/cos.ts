import crypto from 'node:crypto';
import mime from 'mime';
import COS from 'cos-nodejs-sdk-v5';

const MAX_FILE_SIZE_BYTES = Number(process.env.UPLOAD_MAX_BYTES ?? 5 * 1024 * 1024);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
]);
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf']);

type FileValidationMeta = {
  size: number;
  mimeType?: string;
  extension?: string;
};

function assertFileAllowed(meta: FileValidationMeta) {
  if (meta.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }

  const extension = meta.extension?.toLowerCase();
  const mimeType = meta.mimeType?.toLowerCase();
  const extensionAllowed = extension ? ALLOWED_EXTENSIONS.has(extension) : false;
  const mimeAllowed = mimeType ? ALLOWED_MIME_TYPES.has(mimeType) : false;

  if (!extensionAllowed && !mimeAllowed) {
    throw new Error('UNSUPPORTED_FILE_TYPE');
  }
}

function inferExtension(mimeType?: string, originalName?: string): string {
  const fromMime = mimeType ? mime.getExtension(mimeType) : undefined;
  if (fromMime) return fromMime;
  if (originalName) {
    const lastDot = originalName.lastIndexOf('.');
    if (lastDot !== -1 && lastDot < originalName.length - 1) {
      return originalName.slice(lastDot + 1).toLowerCase();
    }
  }
  return 'bin';
}

function sanitizeFolder(folder: string): string {
  return folder
    .replace(/^\/+/, '')
    .split(/[\\/]+/)
    .filter((segment) => segment && segment !== '..')
    .join('/');
}

function encodePathSegments(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

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
  const publicBaseUrl = process.env.COS_PUBLIC_BASE_URL?.trim();
  return { secretId, secretKey, bucket, region, publicBaseUrl };
}

export function isCosConfigured(): boolean {
  const config = resolveCosConfig();
  return Boolean(config.secretId && config.secretKey && config.bucket && config.region);
}

export async function saveUploadedFileToCos(file: File, folder: string, prefix = 'file'): Promise<string> {
  const { secretId, secretKey, bucket, region, publicBaseUrl } = resolveCosConfig();
  if (!secretId || !secretKey || !bucket || !region) {
    throw new Error('COS_NOT_CONFIGURED');
  }

  const arrayBuffer = await file.arrayBuffer();
  const bodyBuffer = Buffer.from(arrayBuffer);
  const extension = inferExtension(file.type, file.name);
  assertFileAllowed({ size: bodyBuffer.byteLength, mimeType: file.type, extension });

  const safeFolder = sanitizeFolder(folder || 'uploads/general');
  const safePrefix = prefix?.trim() ? prefix.trim() : 'file';
  const objectKey = `${safeFolder}/${safePrefix}-${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const cos = new COS({ SecretId: secretId, SecretKey: secretKey });

  await new Promise<void>((resolve, reject) => {
    cos.putObject(
      {
        Bucket: bucket,
        Region: region,
        Key: objectKey,
        Body: bodyBuffer,
        ContentType: file.type || mime.getType(extension) || 'application/octet-stream',
      },
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });

  const encodedKey = encodePathSegments(objectKey);
  const normalizedBase = publicBaseUrl?.replace(/\/+$/, '');
  if (normalizedBase) {
    return `/api/files/cos/${encodedKey}`;
  }
  return `/api/files/cos/${encodedKey}`;
}
