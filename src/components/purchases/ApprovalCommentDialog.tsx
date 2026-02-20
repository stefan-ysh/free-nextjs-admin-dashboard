"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ModalShell from '@/components/common/ModalShell';

export type ApprovalCommentDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => Promise<void> | void;
  submitting?: boolean;
  title?: string;
  description?: string;
};

export function ApprovalCommentDialog({
  open,
  onClose,
  onSubmit,
  submitting = false,
  title = '审批通过',
  description = '请输入审批意见，便于流程留痕与后续追溯。',
}: ApprovalCommentDialogProps) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setComment('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmed = comment.trim();
    if (!trimmed) {
      setError('审批意见不能为空');
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
              <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
                取消
              </Button>
              <Button onClick={handleSubmit} size="sm" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                确认通过
              </Button>
            </DialogFooter>
          }
        >
          <div className="grid gap-3">
            <Label htmlFor="approval-comment">审批意见</Label>
            <Textarea
              id="approval-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              placeholder="例如：同意采购，请按流程执行"
              disabled={submitting}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}

export default ApprovalCommentDialog;
