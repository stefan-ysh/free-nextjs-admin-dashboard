'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DataState from '@/components/common/DataState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  formatMoney,
  reimbursementBadgeClass,
  reimbursementText,
  statusBadgeClass,
  statusText,
} from '@/components/mobile-workflow/shared';
import {
  type PurchaseDetail,
} from '@/types/purchase';
import { toast } from 'sonner';
import { isReimbursementV2Enabled } from '@/lib/features/gates';

type PurchaseDetailResponse = {
  success: boolean;
  data?: PurchaseDetail;
  error?: string;
};

type ActionResponse = {
  success: boolean;
  data?: PurchaseDetail;
  error?: string;
};

export default function MobileTaskDetailClient({
  purchaseId,
  currentUserId,
  canApprove,
  canReject,
  canPay,
}: {
  purchaseId: string;
  currentUserId: string;
  canApprove: boolean;
  canReject: boolean;
  canPay: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<PurchaseDetail | null>(null);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const reimbursementV2Enabled = isReimbursementV2Enabled();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/purchases/${purchaseId}`, { headers: { Accept: 'application/json' } });
      const payload = (await response.json()) as PurchaseDetailResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '加载详情失败');
      }
      setRecord(payload.data);
      const suggested = Number(payload.data.remainingAmount ?? payload.data.dueAmount ?? 0);
      setPayAmount(Number.isFinite(suggested) && suggested > 0 ? String(suggested) : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载详情失败');
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = useCallback(
    async (action: string, body: Record<string, unknown>) => {
      if (!record) return;
      setSubmitting(true);
      try {
        const response = await fetch(`/api/purchases/${record.id}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...body }),
        });
        const payload = (await response.json()) as ActionResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || '操作失败');
        }
        setRecord(payload.data);
        if (action === 'approve' || action === 'reject') {
          setComment('');
          setReason('');
        }
        if (action === 'pay') {
          setPayNote('');
        }
        toast.success('操作成功');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '操作失败');
      } finally {
        setSubmitting(false);
      }
    },
    [record]
  );

  const canApproveCurrent = useMemo(() => {
    if (!record) return false;
    return canApprove && record.status === 'pending_approval';
  }, [record, canApprove]);

  const canRejectCurrent = useMemo(() => {
    if (!record) return false;
    return canReject && record.status === 'pending_approval';
  }, [record, canReject]);

  const canPayCurrent = useMemo(() => {
    if (!record) return false;
    return canPay && record.status === 'approved' && record.reimbursementStatus === 'reimbursement_pending';
  }, [record, canPay]);

  if (loading) return <DataState variant="loading" className="p-8" />;
  if (error || !record) return <DataState variant="error" description={error ?? '数据不存在'} className="p-8" />;

  const total = Number(record.totalAmount) + Number(record.feeAmount ?? 0);
  const status = statusText(record);
  const reimbursementStatus = reimbursementText(record);

  return (
    <div className="space-y-3 pb-3">
      <div className="surface-panel space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold">{record.itemName}</h1>
            <p className="text-xs text-muted-foreground">{record.purchaseNumber}</p>
          </div>
          <div className="space-y-1 text-right">
            <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] ${statusBadgeClass(record.status)}`}>{status}</span>
            <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] ${reimbursementBadgeClass(record.reimbursementStatus)}`}>
              {reimbursementStatus}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border border-border/70 bg-muted/30 p-2">
            <p className="text-muted-foreground">申请人</p>
            <p className="mt-0.5">{record.purchaser?.displayName ?? '-'}</p>
          </div>
          <div className="rounded border border-border/70 bg-muted/30 p-2">
            <p className="text-muted-foreground">总金额</p>
            <p className="mt-0.5">{formatMoney(total)}</p>
          </div>
          <div className="rounded border border-border/70 bg-muted/30 p-2">
            <p className="text-muted-foreground">已付金额</p>
            <p className="mt-0.5">{formatMoney(record.paidAmount)}</p>
          </div>
          <div className="rounded border border-border/70 bg-muted/30 p-2">
            <p className="text-muted-foreground">待付金额</p>
            <p className="mt-0.5">{formatMoney(record.remainingAmount)}</p>
          </div>
        </div>

        <div className="rounded border border-border/70 bg-muted/20 p-2 text-xs text-muted-foreground">
          <p>
            {reimbursementV2Enabled
              ? '流程：采购申请 → 管理员审批 → 到货入库（可关联采购单）→ 报销中心发起报销 → 财务审批与打款'
              : '流程：采购申请 → 管理员审批 → 采购/入库/发票上传 → 提交报销 → 财务打款'}
          </p>
        </div>
      </div>

      {(canApproveCurrent || canRejectCurrent) && (
        <div className="surface-panel space-y-2 p-3">
          <h2 className="text-sm font-semibold">审批操作</h2>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="审批意见（同意时可选，驳回时建议填写）"
            rows={3}
          />
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="驳回原因（驳回必填）"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={submitting || !canApproveCurrent} onClick={() => void runAction('approve', { comment })}>
              同意
            </Button>
            <Button
              variant="destructive"
              disabled={submitting || !canRejectCurrent || !reason.trim()}
              onClick={() => void runAction('reject', { reason: reason.trim(), comment })}
            >
              驳回
            </Button>
          </div>
        </div>
      )}

      {canPayCurrent && (
        <div className="surface-panel space-y-2 p-3">
          <h2 className="text-sm font-semibold">财务打款</h2>
          <Input value={payAmount} onChange={(event) => setPayAmount(event.target.value)} placeholder="打款金额" />
          <Input value={payNote} onChange={(event) => setPayNote(event.target.value)} placeholder="备注（可选）" />
          <Button
            className="w-full"
            disabled={submitting || Number(payAmount) <= 0}
            onClick={() => void runAction('pay', { amount: Number(payAmount), note: payNote || undefined })}
          >
            确认打款
          </Button>
        </div>
      )}

      <div className="px-1">
        <Link href="/m/tasks" className="text-xs text-primary hover:underline">
          返回待办
        </Link>
      </div>
    </div>
  );
}
