import { useEffect, useMemo, useState } from 'react';

import type { PurchaseDetail, PurchaseRecord } from '@/types/purchase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
});

type PurchasePayDialogProps = {
  open: boolean;
  purchase: PurchaseRecord | PurchaseDetail | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (amount: number, note?: string) => Promise<void> | void;
  busy?: boolean;
};

function resolveRemainingAmount(purchase: PurchaseRecord | PurchaseDetail | null): number {
  if (!purchase) return 0;
  const dueAmount = purchase.totalAmount + (purchase.feeAmount ?? 0);
  if ('remainingAmount' in purchase) {
    return Math.max(0, Number(purchase.remainingAmount ?? dueAmount));
  }
  return dueAmount;
}

export default function PurchasePayDialog({
  open,
  purchase,
  onOpenChange,
  onSubmit,
  busy,
}: PurchasePayDialogProps) {
  const remainingAmount = useMemo(() => resolveRemainingAmount(purchase), [purchase]);
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const defaultAmount = remainingAmount > 0 ? remainingAmount : 0;
    setAmount(defaultAmount ? String(defaultAmount) : '');
    setNote('');
    setError(null);
  }, [open, remainingAmount]);

  const handleSubmit = async () => {
    if (!purchase) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('请输入有效的打款金额');
      return;
    }
    if (value > remainingAmount + 0.01) {
      setError('打款金额超过待支付余额');
      return;
    }
    setError(null);
    await onSubmit(value, note.trim() || undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>记录打款</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              待支付金额：{currencyFormatter.format(remainingAmount)}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-amount">打款金额</Label>
              <Input
                id="payment-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="请输入本次打款金额"
                disabled={busy}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-note">备注（可选）</Label>
              <Input
                id="payment-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="例如：首付款 / 第二笔"
                disabled={busy}
              />
            </div>
            {error && <p className="text-xs text-rose-500">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            确认打款
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
