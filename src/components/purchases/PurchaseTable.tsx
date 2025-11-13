'use client';

import { useState } from 'react';
import Image from 'next/image';
import PurchaseStatusBadge from './PurchaseStatusBadge';
import PurchaseDetailModal from './PurchaseDetailModal';
import { PurchaseRecord } from '@/types/purchase';
import { 
  getPurchaseStatusText, 
  getPaymentMethodText, 
  getInvoiceTypeText,
  isPurchaseEditable,
  isPurchaseDeletable 
} from '@/types/purchase';

type PurchaseTableProps = {
  purchases: PurchaseRecord[];
  loading?: boolean;
  onView: (purchase: PurchaseRecord) => void;
  onEdit: (purchase: PurchaseRecord) => void;
  onDelete: (purchase: PurchaseRecord) => void;
  onSubmit?: (purchase: PurchaseRecord) => void;
  onApprove?: (purchase: PurchaseRecord) => void;
  onReject?: (purchase: PurchaseRecord) => void;
  currentUserId?: string;
  canApprove?: boolean;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatAmount(amount: number) {
  return `¥${amount.toFixed(2)}`;
}

export default function PurchaseTable({
  purchases,
  loading,
  onView,
  onEdit,
  onDelete,
  onSubmit,
  onApprove,
  onReject,
  currentUserId,
  canApprove = false,
}: PurchaseTableProps) {
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewClick = (purchase: PurchaseRecord) => {
    setSelectedPurchaseId(purchase.id);
    setIsModalOpen(true);
  };

  const handleModalAction = async (action: string, data?: any) => {
    // Close modal and trigger parent callbacks
    setIsModalOpen(false);
    
    const purchase = purchases.find(p => p.id === selectedPurchaseId);
    if (!purchase) return;

    if (action === 'submit' && onSubmit) {
      onSubmit(purchase);
    } else if (action === 'approve' && onApprove) {
      onApprove(purchase);
    } else if (action === 'reject' && onReject) {
      onReject(purchase);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
          <div className="text-sm text-gray-500 dark:text-gray-400">加载中...</div>
        </div>
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center gap-3">
        <svg
          className="h-16 w-16 text-gray-300 dark:text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <div className="text-sm font-medium text-gray-600 dark:text-gray-300">暂无采购记录</div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          点击右上方"新增采购"按钮创建采购记录
        </div>
      </div>
    );
  }

  const isOwner = (purchase: PurchaseRecord) => currentUserId === purchase.createdBy;
  const canEdit = (purchase: PurchaseRecord) => isOwner(purchase) && isPurchaseEditable(purchase.status);
  const canDelete = (purchase: PurchaseRecord) => isOwner(purchase) && isPurchaseDeletable(purchase.status);
  const canSubmit = (purchase: PurchaseRecord) => 
    isOwner(purchase) && (purchase.status === 'draft' || purchase.status === 'rejected');
  const canDoApproval = (purchase: PurchaseRecord) => 
    canApprove && purchase.status === 'pending_approval';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1200px] border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              采购单号
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              购买日期
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              物品名称
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              数量
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              总金额
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              渠道
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              状态
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((purchase) => (
            <tr
              key={purchase.id}
              className="border-b border-gray-100 bg-white transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/50"
            >
              <td className="px-4 py-4">
                <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {purchase.purchaseNumber}
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  {formatDate(purchase.purchaseDate)}
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="max-w-[200px] truncate text-sm font-medium text-gray-900 dark:text-white">
                  {purchase.itemName}
                </div>
                {purchase.specification && (
                  <div className="max-w-[200px] truncate text-xs text-gray-500 dark:text-gray-400">
                    {purchase.specification}
                  </div>
                )}
              </td>
              <td className="px-4 py-4">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  {purchase.quantity}
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatAmount(purchase.totalAmount)}
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  {purchase.purchaseChannel === 'online' ? '线上' : '线下'}
                </div>
              </td>
              <td className="px-4 py-4">
                <PurchaseStatusBadge status={purchase.status} />
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleViewClick(purchase)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    查看
                  </button>
                  
                  {canEdit(purchase) && (
                    <button
                      onClick={() => onEdit(purchase)}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      编辑
                    </button>
                  )}
                  
                  {canSubmit(purchase) && onSubmit && (
                    <button
                      onClick={() => onSubmit(purchase)}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-green-600 transition-colors hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                    >
                      提交
                    </button>
                  )}
                  
                  {canDoApproval(purchase) && onApprove && (
                    <>
                      <button
                        onClick={() => onApprove(purchase)}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-green-600 transition-colors hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                      >
                        批准
                      </button>
                      {onReject && (
                        <button
                          onClick={() => onReject(purchase)}
                          className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          驳回
                        </button>
                      )}
                    </>
                  )}
                  
                  {canDelete(purchase) && (
                    <button
                      onClick={() => onDelete(purchase)}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      删除
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Detail Modal */}
      {selectedPurchaseId && (
        <PurchaseDetailModal
          purchaseId={selectedPurchaseId}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAction={handleModalAction}
          currentUserId={currentUserId}
          canApprove={canApprove}
        />
      )}
    </div>
  );
}
