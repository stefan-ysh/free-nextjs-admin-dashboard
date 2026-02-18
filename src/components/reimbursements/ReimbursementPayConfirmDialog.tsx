'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Banknote, Building2, CalendarDays, CheckCircle2, CircleAlert, FileText, Hash, Info, Paperclip, Receipt, Tag } from 'lucide-react';

import FilePreviewDialog from '@/components/common/FilePreviewDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ReimbursementRecord } from '@/types/reimbursement';

type ReimbursementDetailResponse = {
  success: boolean;
  data?: ReimbursementRecord & { logs?: unknown[] };
  error?: string;
};

type ReimbursementActionResponse = {
  success: boolean;
  data?: ReimbursementRecord;
  error?: string;
};

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
    // ignore parse errors and fallback to path.
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

function AttachmentList({ title, files, onPreview, icon }: AttachmentListProps) {
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
              <div key={`${fileUrl}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
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

export default function ReimbursementPayConfirmDialog({
  open,
  reimbursementId,
  onOpenChange,
  onPaid,
  onRejected,
}: {
  open: boolean;
  reimbursementId: string | null;
  onOpenChange: (open: boolean) => void;
  onPaid?: () => void;
  onRejected?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [record, setRecord] = useState<ReimbursementRecord | null>(null);
  const [previewTarget, setPreviewTarget] = useState<{ url: string; label: string } | null>(null);

  useEffect(() => {
    if (!open || !reimbursementId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRecord(null);
    setNote('');
    setRejectReason('');
    void fetch(`/api/reimbursements/${reimbursementId}`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        const payload = (await response.json()) as ReimbursementDetailResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || '加载报销详情失败');
        }
        if (cancelled) return;
        setRecord(payload.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载报销详情失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, reimbursementId]);

  const canPay = useMemo(
    () => Boolean(record && (record.status === 'pending_approval' || record.status === 'approved')),
    [record]
  );
  const canReject = canPay;

  const handlePay = useCallback(async () => {
    if (!record || !canPay || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/reimbursements/${record.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'pay', note }),
      });
      const payload = (await response.json()) as ReimbursementActionResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || '打款失败');
      }
      toast.success('报销打款已完成');
      onOpenChange(false);
      onPaid?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '打款失败');
    } finally {
      setBusy(false);
    }
  }, [busy, canPay, note, onOpenChange, onPaid, record]);

  const handleReject = useCallback(async () => {
    if (!record || !canReject || busy) return;
    if (!rejectReason.trim()) {
      toast.error('请填写驳回原因');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/reimbursements/${record.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: rejectReason.trim() }),
      });
      const payload = (await response.json()) as ReimbursementActionResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || '驳回失败');
      }
      toast.success('已驳回');
      onOpenChange(false);
      onRejected?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '驳回失败');
    } finally {
      setBusy(false);
    }
  }, [busy, canReject, onOpenChange, onRejected, record, rejectReason]);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>报销打款确认</DialogTitle>
          </DialogHeader>

          <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
            {loading ? <p className="text-sm text-muted-foreground">正在加载报销详情...</p> : null}
            {!loading && error ? <p className="text-sm text-destructive">{error}</p> : null}

            {!loading && !error && record ? (
              <>
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold">{record.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">请先核对凭证与关键信息，再执行打款。</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                        record.status === 'paid'
                          ? 'border-chart-5/40 bg-chart-5/10 text-chart-5'
                          : 'border-chart-3/40 bg-chart-3/10 text-chart-3'
                      }`}
                    >
                      {record.status === 'paid' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
                      {record.status === 'paid' ? '已打款' : '待处理'}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    <Field icon={<Hash className="h-3.5 w-3.5" />} label="报销单号" value={record.reimbursementNumber} />
                    <Field icon={<Building2 className="h-3.5 w-3.5" />} label="组织" value={record.organizationType === 'school' ? '学校' : '单位'} />
                    <Field icon={<Banknote className="h-3.5 w-3.5" />} label="报销金额" value={currencyFormatter.format(record.amount)} />
                    <Field
                      icon={<FileText className="h-3.5 w-3.5" />}
                      label="报销来源"
                      value={record.sourceType === 'purchase' ? '关联采购' : '直接报销'}
                    />
                    <Field icon={<Tag className="h-3.5 w-3.5" />} label="报销分类" value={String(record.category)} />
                    <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="发生日期" value={record.occurredAt} />
                    {record.sourcePurchaseNumber ? (
                      <Field
                        icon={<Paperclip className="h-3.5 w-3.5" />}
                        label="关联采购单"
                        value={record.sourcePurchaseNumber}
                      />
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      说明
                    </p>
                    <p className="whitespace-pre-line text-sm">{record.description?.trim() || '无说明'}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <AttachmentList
                    title="收款凭证"
                    files={record.receiptImages ?? []}
                    onPreview={(url, label) => setPreviewTarget({ url, label })}
                    icon={<Receipt className="h-4 w-4" />}
                  />
                  <AttachmentList
                    title="发票附件"
                    files={record.invoiceImages ?? []}
                    onPreview={(url, label) => setPreviewTarget({ url, label })}
                    icon={<FileText className="h-4 w-4" />}
                  />
                  <AttachmentList
                    title="其他附件"
                    files={record.attachments ?? []}
                    onPreview={(url, label) => setPreviewTarget({ url, label })}
                    icon={<Paperclip className="h-4 w-4" />}
                  />
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <label className="mb-1 block text-xs text-muted-foreground">打款备注（可选）</label>
                  <Input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="例如：已核对发票及凭证，完成打款"
                    disabled={busy}
                  />
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <label className="mb-1 block text-xs text-muted-foreground">驳回原因（驳回时必填）</label>
                  <Input
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="例如：发票信息不完整，请补充后重新提交"
                    disabled={busy}
                  />
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              取消
            </Button>
            <Button
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => void handleReject()}
              disabled={!canReject || loading || busy || Boolean(error)}
            >
              {busy ? '处理中...' : '驳回'}
            </Button>
            <Button onClick={() => void handlePay()} disabled={!canPay || loading || busy || Boolean(error)}>
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
