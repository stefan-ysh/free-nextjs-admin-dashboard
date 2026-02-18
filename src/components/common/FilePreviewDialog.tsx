'use client';

import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']);

function detectPreviewType(fileUrl: string | null): 'image' | 'pdf' | 'unknown' {
  if (!fileUrl) return 'unknown';
  const cleanUrl = fileUrl.split('?')[0]?.split('#')[0] ?? '';
  const lastDot = cleanUrl.lastIndexOf('.');
  if (lastDot === -1) return 'unknown';
  const extension = cleanUrl.slice(lastDot + 1).toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (extension === 'pdf') return 'pdf';
  return 'unknown';
}

function sanitizePreviewUrl(fileUrl: string | null): string | null {
  if (!fileUrl) return null;
  const isAbsolute = /^https?:\/\//i.test(fileUrl);
  try {
    const parsed = new URL(fileUrl, isAbsolute ? undefined : 'http://local');
    parsed.searchParams.delete('filename');
    if (isAbsolute) return parsed.toString();
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fileUrl;
  }
}

function isCosDirectUrl(url: URL): boolean {
  return /\.cos\.[^.]+\.myqcloud\.com$/i.test(url.hostname);
}

function convertCosUrlToProxy(fileUrl: string | null): string | null {
  if (!fileUrl) return null;
  if (!/^https?:\/\//i.test(fileUrl)) {
    if (!fileUrl.startsWith('/') || fileUrl.startsWith('/api/files/')) return fileUrl;
    try {
      const parsed = new URL(fileUrl, 'http://local');
      const key = parsed.pathname.replace(/^\/+/, '');
      if (!key) return fileUrl;
      const encodedKey = key
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      const fileName = parsed.searchParams.get('filename')?.trim();
      const suffix = fileName ? `?filename=${encodeURIComponent(fileName)}` : '';
      return `/api/files/cos/${encodedKey}${suffix}`;
    } catch {
      return fileUrl;
    }
  }
  try {
    const parsed = new URL(fileUrl);
    if (!isCosDirectUrl(parsed)) return fileUrl;
    const key = parsed.pathname.replace(/^\/+/, '');
    if (!key) return fileUrl;
    const encodedKey = key
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const fileName = parsed.searchParams.get('filename')?.trim();
    const suffix = fileName ? `?filename=${encodeURIComponent(fileName)}` : '';
    return `/api/files/cos/${encodedKey}${suffix}`;
  } catch {
    return fileUrl;
  }
}

type FilePreviewDialogProps = {
  open: boolean;
  fileUrl: string | null;
  fileLabel?: string;
  onClose: () => void;
};

export default function FilePreviewDialog({ open, fileUrl, fileLabel, onClose }: FilePreviewDialogProps) {
  const previewType = detectPreviewType(fileUrl);
  const previewUrl = convertCosUrlToProxy(sanitizePreviewUrl(fileUrl));

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>附件预览</DialogTitle>
          {fileLabel ? <DialogDescription className="break-all text-xs text-muted-foreground">{fileLabel}</DialogDescription> : null}
        </DialogHeader>
        <DialogBody>
          {previewType === 'image' && previewUrl ? (
            <div className="relative flex max-h-[70vh] w-full justify-center overflow-auto rounded-md border bg-muted/40 p-2">
              <Image
                src={previewUrl}
                alt={fileLabel ?? '附件预览'}
                width={800}
                height={600}
                className="h-auto w-auto max-w-full rounded-md object-contain"
                unoptimized
              />
            </div>
          ) : previewType === 'pdf' && previewUrl ? (
            <iframe
              src={previewUrl}
              title="附件预览"
              className="h-[70vh] w-full rounded-md border"
            />
          ) : (
            <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
              暂不支持此格式的在线预览。
            </p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
