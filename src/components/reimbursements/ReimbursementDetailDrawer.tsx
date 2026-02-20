"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import FileUpload from '@/components/common/FileUpload';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import RejectionReasonDialog from '@/components/purchases/RejectionReasonDialog';
import PaymentConfirmDialog from './PaymentConfirmDialog';
import WorkflowStepList from '@/components/common/WorkflowStepList';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDateOnly } from '@/lib/dates';
import { UserRole } from '@/types/user';
import type {
  ReimbursementLog,
  ReimbursementRecord,
} from '@/types/reimbursement';
import { REIMBURSEMENT_CATEGORY_FIELDS } from '@/types/reimbursement';

const MONEY = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' });





function toDateInputValue(value?: string | null): string {
  return formatDateOnly(value) ?? '';
}

export type ReimbursementDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: ReimbursementRecord | null;
  onSuccess?: () => void;
};

export default function ReimbursementDetailDrawer({
  open,
  onClose,
  record,
  onSuccess,
}: ReimbursementDetailDrawerProps) {
  const { user, hasPermission } = usePermissions();
  const [currentLogs, setCurrentLogs] = useState<ReimbursementLog[]>([]);
  const [rejectTarget, setRejectTarget] = useState<ReimbursementRecord | null>(null);
  const [payTarget, setPayTarget] = useState<ReimbursementRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const canApprove = hasPermission('REIMBURSEMENT_APPROVE');
  const canPay = hasPermission('REIMBURSEMENT_PAY');
  const role = user?.primaryRole;

  const loadDetailLogs = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/reimbursements/${id}`, { headers: { Accept: 'application/json' } });
      const payload = (await response.json()) as { success: boolean; data?: (ReimbursementRecord & { logs?: ReimbursementLog[] }) };
      if (!response.ok || !payload.success || !payload.data) return;
      setCurrentLogs((payload.data.logs ?? []).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch {
      setCurrentLogs([]);
    }
  }, []);

  useEffect(() => {
    if (open && record) {
      void loadDetailLogs(record.id);
    } else {
      setCurrentLogs([]);
    }
  }, [open, record, loadDetailLogs]);

  const runAction = useCallback(
    async (id: string, action: 'submit' | 'approve' | 'reject' | 'pay' | 'withdraw', body: Record<string, unknown> = {}) => {
      const response = await fetch(`/api/reimbursements/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      const payload = (await response.json()) as { success: boolean; data?: ReimbursementRecord; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '操作失败');
      }
      return payload.data ?? null;
    },
    []
  );

  const handleApprove = useCallback(async () => {
    if (!record) return;
    setActionLoading(true);
    try {
      await runAction(record.id, 'approve');
      toast.success('审批通过');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '审批失败');
    } finally {
      setActionLoading(false);
    }
  }, [record, runAction, onSuccess, onClose]);

  const confirmReject = useCallback(
    async (reason: string) => {
      if (!record) return;
      setActionLoading(true);
      try {
        await runAction(record.id, 'reject', { reason });
        toast.success('已驳回');
        setRejectTarget(null);
        onSuccess?.();
        onClose();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '驳回失败');
      } finally {
        setActionLoading(false);
      }
    },
    [record, runAction, onSuccess, onClose]
  );

  const confirmPay = useCallback(
    async (note: string) => {
      if (!record) return;
      setActionLoading(true);
      try {
        await runAction(record.id, 'pay', { note });
        toast.success('已标记打款');
        setPayTarget(null);
        onSuccess?.();
        onClose();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '打款失败');
      } finally {
        setActionLoading(false);
      }
    },
    [record, runAction, onSuccess, onClose]
  );

  const canOperatePay = useMemo(() => {
    if (!record || !canPay || (record.status !== 'approved' && record.status !== 'pending_approval')) return false;
    if (role === UserRole.FINANCE_SCHOOL) return record.organizationType === 'school';
    if (role === UserRole.FINANCE_COMPANY) return record.organizationType === 'company';
    return false;
  }, [record, canPay, role]);

  const canApproveInDrawer = useMemo(() => {
    return Boolean(record && canApprove && record.status === 'pending_approval' && !canPay);
  }, [record, canApprove, canPay]);

  const canRejectInDrawer = useMemo(() => {
    return Boolean(record && canApprove && record.status === 'pending_approval');
  }, [record, canApprove]);

  if (!record) return null;

  return (
    <>
      <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction="right">
        <DrawerContent side="right" className="w-full max-w-3xl">
          <DrawerHeader>
            <DrawerTitle>报销详情</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">申请人</div>
                <div className="text-sm">{record.applicantName || '未知'}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">报销来源</div>
                <div className="text-sm">{record.sourceType === 'purchase' ? '关联采购' : '直接报销'}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">组织</div>
                <div className="text-sm">{record.organizationType === 'school' ? '学校' : '单位'}</div>
              </div>
            </div>

            {record.sourceType === 'purchase' && record.sourcePurchaseNumber && (
              <div className="space-y-2 rounded-xl border border-border/60 p-3">
                <div className="text-sm font-medium text-muted-foreground">关联采购单</div>
                <div className="text-sm">{record.sourcePurchaseNumber}</div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">报销分类</div>
                <div className="text-sm">{record.category}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">发生日期</div>
                <div className="text-sm">{toDateInputValue(record.occurredAt)}</div>
              </div>
            </div>

            {(REIMBURSEMENT_CATEGORY_FIELDS[record.category] ?? []).length > 0 ? (
              <div className="space-y-3 rounded-xl border border-border/60 p-3">
                <div className="text-sm font-medium">分类信息</div>
                <div className="grid gap-4 md:grid-cols-2">
                  {(REIMBURSEMENT_CATEGORY_FIELDS[record.category] ?? []).map((field) => {
                    const value = record.details?.[field.key] ?? '-';
                    return (
                      <div key={field.key} className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">{field.label}</div>
                        <div className="text-sm">{value}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">标题</div>
                <div className="text-sm">{record.title}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">金额</div>
                <div className="text-sm font-semibold text-primary">{MONEY.format(record.amount)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">说明</div>
              <div className="text-sm whitespace-pre-wrap">{record.description || '无说明'}</div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {record.receiptImages.length > 0 && (
                <div className="space-y-3 rounded-xl border border-border/60 p-3">
                  <div className="text-sm font-medium">收款凭证</div>
                  <FileUpload
                    files={record.receiptImages}
                    readOnly
                    onChange={() => {}}
                  />
                </div>
              )}
              {record.invoiceImages.length > 0 && (
                <div className="space-y-3 rounded-xl border border-border/60 p-3">
                  <div className="text-sm font-medium">发票附件</div>
                  <FileUpload
                    files={record.invoiceImages}
                    readOnly
                    onChange={() => {}}
                  />
                </div>
              )}
            </div>

            {record.attachments.length > 0 && (
              <div className="space-y-3 rounded-xl border border-border/60 p-3">
                <div className="text-sm font-medium">其他附件</div>
                <FileUpload
                  files={record.attachments}
                  readOnly
                  onChange={() => {}}
                />
              </div>
            )}

              <div className="space-y-3 rounded-xl border border-border/60 p-3">
                <div className="text-sm font-medium">流程节点</div>
                <WorkflowStepList logs={currentLogs} />
              </div>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="outline" onClick={onClose} disabled={actionLoading}>
              关闭
            </Button>
            {canRejectInDrawer && (
              <Button
                variant="outline"
                onClick={() => setRejectTarget(record)}
                disabled={actionLoading}
              >
                驳回
              </Button>
            )}
            {canApproveInDrawer && (
              <Button
                onClick={() => void handleApprove()}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                审批通过
              </Button>
            )}
            {canOperatePay && (
              <Button onClick={() => setPayTarget(record)} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                标记打款
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <RejectionReasonDialog
        open={!!rejectTarget}
        onClose={() => !actionLoading && setRejectTarget(null)}
        onSubmit={confirmReject}
        submitting={actionLoading}
        title="驳回报销申请"
        description="请填写驳回原因，提交后申请人将收到通知。"
      />

      <PaymentConfirmDialog
        open={!!payTarget}
        onClose={() => !actionLoading && setPayTarget(null)}
        onSubmit={confirmPay}
        submitting={actionLoading}
      />
    </>
  );
}
