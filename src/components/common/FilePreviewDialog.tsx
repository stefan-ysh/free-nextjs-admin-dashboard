'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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

type FilePreviewDialogProps = {
  open: boolean;
  fileUrl: string | null;
  fileLabel?: string;
  onClose: () => void;
};

export default function FilePreviewDialog({ open, fileUrl, fileLabel, onClose }: FilePreviewDialogProps) {
  const previewType = detectPreviewType(fileUrl);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>附件预览</DialogTitle>
          {fileLabel ? <DialogDescription className="break-all text-xs text-muted-foreground">{fileLabel}</DialogDescription> : null}
        </DialogHeader>
        {previewType === 'image' && fileUrl ? (
          <div className="max-h-[70vh] overflow-auto rounded-md border bg-muted/40 p-2">
            <img src={fileUrl} alt={fileLabel ?? '附件预览'} className="mx-auto max-h-[65vh] w-auto rounded-md" />
          </div>
        ) : previewType === 'pdf' && fileUrl ? (
          <iframe
            src={fileUrl}
            title="附件预览"
            className="h-[70vh] w-full rounded-md border"
          />
        ) : (
          <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
            暂不支持此格式的在线预览，可点击下方按钮在新窗口打开或下载附件。
          </p>
        )}
        {fileUrl ? (
          <div className="flex justify-end gap-3">
            <Button variant="outline" asChild>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                在新窗口打开
              </a>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
