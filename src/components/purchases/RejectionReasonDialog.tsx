"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ModalShell from '@/components/common/ModalShell';

export type RejectionReasonDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void> | void;
  defaultReason?: string;
  submitting?: boolean;
  title?: string;
  description?: string;
};

export function RejectionReasonDialog({
  open,
  onClose,
  onSubmit,
  defaultReason = '资料不完整',
  submitting = false,
  title = '驳回采购申请',
  description = '请输入驳回原因，以便申请人根据具体反馈修改内容。',
}: RejectionReasonDialogProps) {
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
      setError('驳回原因不能为空');
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
          title={title}
          description={description}
          className="max-h-[70vh]"
          footer={
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} disabled={submitting}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                确认驳回
              </Button>
            </DialogFooter>
          }
        >
          <div className="grid gap-3">
            <Label htmlFor="rejection-reason">驳回原因</Label>
            <Textarea
              id="rejection-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder="请详细说明驳回原因"
              disabled={submitting}
            />
            {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          </div>
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}

export default RejectionReasonDialog;
