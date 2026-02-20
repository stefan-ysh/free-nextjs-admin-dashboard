'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Banknote,
  CalendarDays,
  FileText,
  Info,
  Paperclip,
  Receipt,
  User,
} from 'lucide-react';

import FilePreviewDialog from '@/components/common/FilePreviewDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PurchaseRecord } from '@/types/purchase';
import { ReactNode } from 'react';

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
});

function extractFileLabel(fileUrl: string, index: number): string {
  try {
    const parsed = new URL(fileUrl, 'http://local');
    const fileName = parsed.searchParams.get('filename');
    if (fileName?.trim()) return fileName.trim();
  } catch {
    // ignore parse errors
  }
  const clean = decodeURIComponent(fileUrl || '');
  const segments = clean.split('/').filter(Boolean);
  return segments[segments.length - 1] || `附件 ${index + 1}`;
}

type AttachmentListProps = {
  title: string;
  files: string[];
  onPreview: (url: string, label: string) => void;
  icon: ReactNode;
};

function AttachmentList({
  title,
  files,
  onPreview,
  icon,
}: AttachmentListProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </h4>
        <span className="text-xs text-muted-foreground">{files.length} 个</span>
      </div>
      {files.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-2 py-3 text-center text-xs text-muted-foreground">
          无附件
        </div>
      ) : (
        <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
          {files.map((fileUrl, index) => {
            const label = extractFileLabel(fileUrl, index);
            return (
              <div
                key={`${fileUrl}-${index}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 p-2"
              >
                <p className="truncate text-xs">{label}</p>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => onPreview(fileUrl, label)}
                  >
                    预览
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

export default function PurchasePayConfirmDialog({
  open,
  purchase,
  onOpenChange,
  onPaid,
}: {
  open: boolean;
  purchase: PurchaseRecord | null;
  onOpenChange: (open: boolean) => void;
  onPaid?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [previewTarget, setPreviewTarget] = useState<{
    url: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setNote('');
    }
  }, [open]);

  const handlePay = useCallback(async () => {
    if (!purchase || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/purchases/${purchase.id}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ action: 'pay', note }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || '打款失败');
      }
      toast.success('采购打款已完成');
      onOpenChange(false);
      onPaid?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '打款失败');
    } finally {
      setBusy(false);
    }
  }, [busy, note, onOpenChange, onPaid, purchase]);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>采购打款确认</DialogTitle>
          </DialogHeader>

          <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
            {purchase ? (
              <>
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="mb-3">
                    <h3 className="text-base font-semibold">
                      {purchase.itemName}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {purchase.purchaseNumber}
                    </p>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    <Field
                      icon={<Banknote className="h-3.5 w-3.5" />}
                      label="采购金额"
                      value={currencyFormatter.format(purchase.totalAmount)}
                    />
                    <Field
                      icon={<User className="h-3.5 w-3.5" />}
                      label="申请人"
                      value={purchase.purchaserName || purchase.purchaserId}
                    />
                    <Field
                      icon={<CalendarDays className="h-3.5 w-3.5" />}
                      label="采购日期"
                      value={purchase.purchaseDate}
                    />
                    <Field
                      icon={<Info className="h-3.5 w-3.5" />}
                      label="付款方式"
                      value={purchase.paymentMethod}
                    />
                    <Field
                      icon={<Info className="h-3.5 w-3.5" />}
                      label="发票类型"
                      value={purchase.invoiceType}
                    />
                    {purchase.payerName ? (
                        <Field
                        icon={<User className="h-3.5 w-3.5" />}
                        label="收款方/支付对象"
                        value={purchase.payerName}
                        />
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      用途/说明
                    </p>
                    <p className="whitespace-pre-line text-sm">
                      {purchase.purpose || '无说明'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <AttachmentList
                    title="发票附件"
                    files={purchase.invoiceImages ?? []}
                    onPreview={(url, label) => setPreviewTarget({ url, label })}
                    icon={<FileText className="h-4 w-4" />}
                  />
                  <AttachmentList
                    title="支付凭证"
                    files={purchase.receiptImages ?? []}
                    onPreview={(url, label) => setPreviewTarget({ url, label })}
                    icon={<Receipt className="h-4 w-4" />}
                  />
                  <AttachmentList
                    title="其他附件"
                    files={purchase.attachments ?? []}
                    onPreview={(url, label) => setPreviewTarget({ url, label })}
                    icon={<Paperclip className="h-4 w-4" />}
                  />
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <label className="mb-1 block text-xs text-muted-foreground">
                    打款备注（可选）
                  </label>
                  <Input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="例如：已完成对公转账"
                    disabled={busy}
                  />
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              取消
            </Button>
            <Button size="sm" onClick={() => void handlePay()} disabled={busy}>
              {busy ? '打款中...' : '确认打款'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FilePreviewDialog
        open={Boolean(previewTarget)}
        fileUrl={previewTarget?.url ?? null}
        fileLabel={previewTarget?.label}
        onClose={() => setPreviewTarget(null)}
      />
    </>
  );
}
