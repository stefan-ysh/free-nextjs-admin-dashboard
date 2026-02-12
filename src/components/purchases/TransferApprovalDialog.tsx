"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ModalShell from '@/components/common/ModalShell';
import ApproverSelect from '@/components/common/ApproverSelect';

export type TransferApprovalDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { approverId: string; comment: string }) => Promise<void> | void;
  submitting?: boolean;
};

export function TransferApprovalDialog({
  open,
  onClose,
  onSubmit,
  submitting = false,
}: TransferApprovalDialogProps) {
  const [approverId, setApproverId] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setApproverId('');
      setComment('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmedComment = comment.trim();
    if (!approverId) {
      setError('请选择转审对象');
      return;
    }
    if (!trimmedComment) {
      setError('转审说明不能为空');
      return;
    }
    setError(null);
    onSubmit({ approverId, comment: trimmedComment });
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <ModalShell
          title="转交审批"
          description="选择新的审批人并填写转审说明，系统会记录此次转交。"
          className="max-h-[70vh]"
          footer={
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} disabled={submitting}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                确认转交
              </Button>
            </DialogFooter>
          }
        >
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>转审对象</Label>
              <ApproverSelect value={approverId} onChange={setApproverId} placeholder="选择审批人" disabled={submitting} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transfer-comment">转审说明</Label>
              <Textarea
                id="transfer-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={4}
                placeholder="说明转交原因或需要关注的重点"
                disabled={submitting}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}

export default TransferApprovalDialog;
