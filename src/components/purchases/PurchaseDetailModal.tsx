'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import PurchaseStatusBadge from './PurchaseStatusBadge';
import { 
  getPaymentMethodText, 
  getInvoiceTypeText,
  isPurchaseSubmittable,
  isPurchaseWithdrawable,
  PurchaseStatus,
  PaymentMethod,
  InvoiceType,
  PurchaseChannel,
  ReimbursementLog,
  ReimbursementAction,
} from '@/types/purchase';

type PurchaseDetailAction = 'submit' | 'withdraw' | 'approve' | 'reject' | 'pay';

type PurchaseSummaryUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  employeeCode?: string | null;
  department?: string | null;
};

type PurchaseDetailModalProps = {
  purchaseId: string;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: PurchaseDetailAction, data?: unknown) => void;
  currentUserId?: string;
  canApprove?: boolean;
};

type PurchaseDetail = {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  itemName: string;
  specification: string | null;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  purchaseChannel: PurchaseChannel;
  purchaseLocation: string | null;
  purchaseLink: string | null;
  purpose: string;
  paymentMethod: PaymentMethod;
  invoiceType: InvoiceType;
  invoiceImages: string[];
  receiptImages: string[];
  hasProject: boolean;
  status: PurchaseStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  paidAt: string | null;
  notes: string | null;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  purchaser: PurchaseSummaryUser | null;
  project: {
    id: string;
    projectCode: string;
    projectName: string;
  } | null;
  approver: {
    id: string;
    displayName: string;
  } | null;
  rejecter: {
    id: string;
    displayName: string;
  } | null;
  payer: {
    id: string;
    displayName: string;
  } | null;
  logs: ReimbursementLog[];
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmount(amount: number) {
  return `¥${amount.toFixed(2)}`;
}

const ACTION_LABELS: Record<ReimbursementAction, string> = {
  submit: '提交审批',
  approve: '批准',
  reject: '驳回',
  pay: '标记已打款',
  cancel: '取消',
  withdraw: '撤回',
};

export default function PurchaseDetailModal({
  purchaseId,
  isOpen,
  onClose,
  onAction,
  currentUserId,
  canApprove = false,
}: PurchaseDetailModalProps) {
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/purchases/${purchaseId}?detailed=true`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setDetail(result.data);
        }
      }
    } catch (error) {
      console.error('加载详情失败', error);
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    if (isOpen && purchaseId) {
      void fetchDetail();
    }
  }, [isOpen, purchaseId, fetchDetail]);

  if (!isOpen) return null;

  const isOwner = currentUserId === detail?.createdBy;
  const canSubmit = Boolean(isOwner && detail && isPurchaseSubmittable(detail.status));
  const canWithdraw = Boolean(isOwner && detail && isPurchaseWithdrawable(detail.status));
  const canDoApproval = canApprove && detail?.status === 'pending_approval';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">采购详情</h2>
            {detail && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {detail.purchaseNumber}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
            </div>
          ) : !detail ? (
            <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
              加载失败
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status and Actions */}
              <div className="flex items-center justify-between">
                <PurchaseStatusBadge status={detail.status} />
                <div className="flex gap-2">
                  {canSubmit && onAction && (
                    <button
                      onClick={() => onAction('submit')}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                    >
                      提交审批
                    </button>
                  )}
                  {canWithdraw && onAction && (
                    <button
                      onClick={() => onAction('withdraw')}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      撤回
                    </button>
                  )}
                  {canDoApproval && onAction && (
                    <>
                      <button
                        onClick={() => onAction('approve')}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                      >
                        批准
                      </button>
                      <button
                        onClick={() => onAction('reject')}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                      >
                        驳回
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">物品名称</div>
                  <div className="mt-1 font-medium text-gray-900 dark:text-white">{detail.itemName}</div>
                  {detail.specification && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{detail.specification}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">购买日期</div>
                  <div className="mt-1 text-gray-900 dark:text-white">{formatDate(detail.purchaseDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">数量 × 单价</div>
                  <div className="mt-1 text-gray-900 dark:text-white">
                    {detail.quantity} × {formatAmount(detail.unitPrice)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">总金额</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    {formatAmount(detail.totalAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">购买渠道</div>
                  <div className="mt-1 text-gray-900 dark:text-white">
                    {detail.purchaseChannel === 'online' ? '线上' : '线下'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {detail.purchaseChannel === 'online' ? '购买链接' : '购买地点'}
                  </div>
                  <div className="mt-1 text-gray-900 dark:text-white">
                    {detail.purchaseChannel === 'online' ? (
                      <a
                        href={detail.purchaseLink || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        查看链接
                      </a>
                    ) : (
                      detail.purchaseLocation
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">用途说明</div>
                  <div className="mt-1 text-gray-900 dark:text-white">{detail.purpose}</div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">付款方式</div>
                  <div className="mt-1 text-gray-900 dark:text-white">
                    {getPaymentMethodText(detail.paymentMethod)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">发票类型</div>
                  <div className="mt-1 text-gray-900 dark:text-white">
                    {getInvoiceTypeText(detail.invoiceType)}
                  </div>
                </div>
                {detail.purchaser && (
                  <div className="col-span-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">付款人</div>
                    <div className="mt-2 flex items-center gap-2">
                      {detail.purchaser.avatarUrl ? (
                        <Image
                          src={detail.purchaser.avatarUrl}
                          alt={detail.purchaser.displayName}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                          {detail.purchaser.displayName.slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {detail.purchaser.displayName}
                        </div>
                        {detail.purchaser.department && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {detail.purchaser.department}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Images */}
              {(detail.invoiceImages.length > 0 || detail.receiptImages.length > 0) && (
                <div className="space-y-4">
                  {detail.invoiceImages.length > 0 && (
                    <div>
                      <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">发票图片</div>
                      <div className="grid grid-cols-3 gap-2">
                        {detail.invoiceImages.map((url, i) => (
                          <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                            <Image src={url} alt={`发票 ${i + 1}`} fill className="object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {detail.receiptImages.length > 0 && (
                    <div>
                      <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">小票图片</div>
                      <div className="grid grid-cols-3 gap-2">
                        {detail.receiptImages.map((url, i) => (
                          <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                            <Image src={url} alt={`小票 ${i + 1}`} fill className="object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Logs Timeline */}
              {detail.logs.length > 0 && (
                <div>
                  <div className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">操作日志</div>
                  <div className="space-y-3">
                    {detail.logs.map((log, index) => (
                      <div key={log.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30">
                            <div className="h-2 w-2 rounded-full bg-brand-600 dark:bg-brand-400" />
                          </div>
                          {index < detail.logs.length - 1 && (
                            <div className="h-full w-px bg-gray-200 dark:bg-gray-700" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {ACTION_LABELS[log.action] || log.action}
                          </div>
                          {log.comment && (
                            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{log.comment}</div>
                          )}
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                            {formatDate(log.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {detail.notes && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">备注</div>
                  <div className="mt-1 text-gray-900 dark:text-white">{detail.notes}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
