import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import mime from 'mime';

const DEFAULT_DIR_NAME = 'free-nextjs-admin-storage';
export const PUBLIC_PREFIX = '/api/files';
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

export function getLocalStorageRoot(): string {
  const configured = process.env.LOCAL_STORAGE_ROOT?.trim();
  if (configured && configured.length > 0) {
    return path.resolve(configured);
  }
  return path.join(os.homedir(), 'Documents', DEFAULT_DIR_NAME);
}

async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

function buildFilePath(folder: string, prefix: string, extension: string) {
  const safeFolder = sanitizeFolder(folder || 'misc');
  const safePrefix = prefix?.trim() ? prefix.trim() : 'file';
  const fileName = `${safePrefix}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const relativePath = path.join(safeFolder, fileName);
  const absoluteDir = path.join(getLocalStorageRoot(), safeFolder);
  const absolutePath = path.join(absoluteDir, fileName);
  return { relativePath, absoluteDir, absolutePath };
}

async function persistBuffer(
  buffer: Buffer,
  folder: string,
  prefix: string,
  extension: string
): Promise<string> {
  const { relativePath, absoluteDir, absolutePath } = buildFilePath(folder, prefix, extension);
  await ensureDirectory(absoluteDir);
  await fs.writeFile(absolutePath, buffer);
  return `${PUBLIC_PREFIX}/${relativePath.split(path.sep).join('/')}`;
}

function sanitizeFolder(folder: string): string {
  return folder
    .replace(/^\/+/, '')
    .split(/[\\/]+/)
    .filter((segment) => segment && segment !== '..')
    .join(path.sep);
}

function decodeBase64DataUri(base64Data: string) {
  const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = matches?.[1] ?? 'application/octet-stream';
  const data = matches?.[2] ?? base64Data;
  const buffer = Buffer.from(data, 'base64');
  const extension = mime.getExtension(mimeType) || 'bin';
  return { buffer, mimeType, extension };
}

export function isBase64DataUri(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^data:[^;]+;base64,/.test(value);
}

export async function saveBase64File(
  base64Data: string,
  folder: string,
  prefix = 'file'
): Promise<string> {
  if (!isBase64DataUri(base64Data)) {
    throw new Error('The provided string is not a valid base64 data URI');
  }

  const { buffer, extension, mimeType } = decodeBase64DataUri(base64Data);
  assertFileAllowed({ size: buffer.byteLength, mimeType, extension });
  return persistBuffer(buffer, folder, prefix, extension);
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

export async function saveUploadedFile(
  file: File,
  folder: string,
  prefix = 'file'
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const extension = inferExtension(file.type, file.name);
  assertFileAllowed({ size: buffer.byteLength, mimeType: file.type, extension });
  return persistBuffer(buffer, folder, prefix, extension);
}

function resolveRelativeFromPublic(publicPath: string): string | null {
  if (!publicPath) return null;
  if (!publicPath.startsWith(PUBLIC_PREFIX)) {
    return null;
  }
  const relative = publicPath.slice(PUBLIC_PREFIX.length).replace(/^\/+/, '');
  if (relative.includes('..')) return null;
  return relative;
}

export async function deleteStoredFile(publicPath: string): Promise<void> {
  const relative = resolveRelativeFromPublic(publicPath);
  if (!relative) return;
  const target = path.join(getLocalStorageRoot(), relative);
  try {
    await fs.unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('删除本地文件失败:', error);
    }
  }
}

export function buildAbsolutePathFromSegments(segments: string[]): string | null {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const sanitized = segments
    .map((segment) => segment.replace(/[\\]/g, '/'))
    .filter((segment) => segment && segment !== '..');
  if (sanitized.length === 0) return null;
  const root = getLocalStorageRoot();
  const resolved = path.resolve(root, ...sanitized);
  if (!resolved.startsWith(root)) {
    return null;
  }
  return resolved;
}
