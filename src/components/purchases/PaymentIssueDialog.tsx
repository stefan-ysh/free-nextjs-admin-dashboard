"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ModalShell from '@/components/common/ModalShell';

export type PaymentIssueDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void> | void;
  defaultReason?: string;
  submitting?: boolean;
};

export function PaymentIssueDialog({
  open,
  onClose,
  onSubmit,
  defaultReason = '',
  submitting = false,
}: PaymentIssueDialogProps) {
  const [reason, setReason] = useState(defaultReason);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason(defaultReason);
      setError(null);
    }
  }, [open, defaultReason]);

  const handleSubmit = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('异常说明不能为空');
      return;
    }
    setError(null);
    onSubmit(trimmed);
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <ModalShell
          title="标记付款异常"
          description="请输入异常说明，系统将提醒相关人员处理。"
          className="max-h-[70vh]"
          footer={
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} disabled={submitting}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                确认标记
              </Button>
            </DialogFooter>
          }
        >
          <div className="grid gap-3">
            <Label htmlFor="payment-issue-reason">异常说明</Label>
            <Textarea
              id="payment-issue-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder="请填写发票不一致、收款账户异常等说明"
              disabled={submitting}
            />
            {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          </div>
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentIssueDialog;
