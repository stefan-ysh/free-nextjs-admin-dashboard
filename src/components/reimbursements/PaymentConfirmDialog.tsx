"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ModalShell from '@/components/common/ModalShell';

export type PaymentConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void> | void;
  defaultNote?: string;
  submitting?: boolean;
};

export default function PaymentConfirmDialog({
  open,
  onClose,
  onSubmit,
  defaultNote = '',
  submitting = false,
}: PaymentConfirmDialogProps) {
  const [note, setNote] = useState(defaultNote);

  useEffect(() => {
    if (open) {
      setNote(defaultNote);
    }
  }, [open, defaultNote]);

  const handleSubmit = () => {
    onSubmit(note.trim());
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <ModalShell
          title="确认打款"
          description="请确认打款信息并输入备注（可选）。"
          className="max-h-[70vh]"
          footer={
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
                取消
              </Button>
              <Button onClick={handleSubmit} size="sm" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                确认打款
              </Button>
            </DialogFooter>
          }
        >
          <div className="grid gap-3">
            <Label htmlFor="payment-note">打款备注</Label>
            <Textarea
              id="payment-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="请输入打款备注（可选）"
              disabled={submitting}
            />
          </div>
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}
