'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import PurchaseTable from '@/components/purchases/PurchaseTable';
import { PurchaseRecord, ListPurchasesResult, PurchaseStatus } from '@/types/purchase';

type CurrentUserSummary = {
  id: string;
  roles: string[];
};

export default function PurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | 'all'>('all');
  const [currentUser, setCurrentUser] = useState<CurrentUserSummary | null>(null);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.set('search', search);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/purchases?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch');

      const result: { success: boolean; data: ListPurchasesResult } = await response.json();
      if (result.success) {
        setPurchases(result.data.items);
        setTotal(result.data.total);
      }
    } catch (error) {
      console.error('加载采购列表失败', error);
      alert('加载失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const result: { success: boolean; data: CurrentUserSummary } = await res.json();
        if (result.success && isMounted) {
          setCurrentUser(result.data);
        }
      } catch (error) {
        console.error('加载用户信息失败', error);
      }
    };

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleEdit = (purchase: PurchaseRecord) => {
    router.push(`/purchases/${purchase.id}/edit`);
  };

  const handleWithdraw = async (purchase: PurchaseRecord) => {
    if (!confirm(`确定要撤回采购 ${purchase.purchaseNumber} 吗？`)) return;

    try {
      const response = await fetch(`/api/purchases/${purchase.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw' }),
      });
      if (!response.ok) throw new Error('Failed to withdraw');

      const result = await response.json();
      if (result.success) {
        alert('撤回成功');
        fetchPurchases();
      }
    } catch (error) {
      console.error('撤回失败', error);
      alert('撤回失败，请重试');
    }
  };

  const handleDelete = async (purchase: PurchaseRecord) => {
    if (!confirm(`确定要删除采购 ${purchase.purchaseNumber} 吗？`)) return;

    try {
      const response = await fetch(`/api/purchases/${purchase.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      
      const result = await response.json();
      if (result.success) {
        alert('删除成功');
        fetchPurchases();
      }
    } catch (error) {
      console.error('删除失败', error);
      alert('删除失败，请重试');
    }
  };

  const handleSubmit = async (purchase: PurchaseRecord) => {
    if (!confirm(`确定要提交采购 ${purchase.purchaseNumber} 进行审批吗？`)) return;

    try {
      const response = await fetch(`/api/purchases/${purchase.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' }),
      });
      if (!response.ok) throw new Error('Failed to submit');
      
      const result = await response.json();
      if (result.success) {
        alert('提交成功');
        fetchPurchases();
      }
    } catch (error) {
      console.error('提交失败', error);
      alert('提交失败，请重试');
    }
  };

  const handleApprove = async (purchase: PurchaseRecord) => {
    if (!confirm(`确定要批准采购 ${purchase.purchaseNumber} 吗？`)) return;

    try {
      const response = await fetch(`/api/purchases/${purchase.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (!response.ok) throw new Error('Failed to approve');
      
      const result = await response.json();
      if (result.success) {
        alert('批准成功');
        fetchPurchases();
      }
    } catch (error) {
      console.error('批准失败', error);
      alert('批准失败，请重试');
    }
  };

  const handleReject = async (purchase: PurchaseRecord) => {
    const reason = prompt('请输入驳回原因：');
    if (!reason) return;

    try {
      const response = await fetch(`/api/purchases/${purchase.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason }),
      });
      if (!response.ok) throw new Error('Failed to reject');
      
      const result = await response.json();
      if (result.success) {
        alert('驳回成功');
        fetchPurchases();
      }
    } catch (error) {
      console.error('驳回失败', error);
      alert('驳回失败，请重试');
    }
  };

  const canApprove = currentUser?.roles?.includes('FINANCE') || 
                     currentUser?.roles?.includes('ADMIN') || 
                     currentUser?.roles?.includes('SUPER_ADMIN');

  return (
    <>
      <PageBreadCrumb pageTitle="采购管理" />

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-gray-200 p-6 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">采购列表</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              管理采购垫付和报销记录
            </p>
          </div>
          <button
            onClick={() => router.push('/purchases/new')}
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-hidden focus:ring-3 focus:ring-brand-500/50 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            新增采购
          </button>
        </div>

        {/* Filters */}
        <div className="border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <input
                type="text"
                placeholder="搜索采购单号、物品名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    fetchPurchases();
                  }
                }}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              />
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as PurchaseStatus | 'all');
                  setPage(1);
                }}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
              >
                <option value="all">全部状态</option>
                <option value="draft">草稿</option>
                <option value="pending_approval">待审批</option>
                <option value="approved">已批准</option>
                <option value="rejected">已驳回</option>
                <option value="paid">已打款</option>
                <option value="cancelled">已取消</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setPage(1);
                }}
                className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                重置筛选
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="p-6">
          <PurchaseTable
            purchases={purchases}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSubmit={handleSubmit}
            onApprove={canApprove ? handleApprove : undefined}
            onReject={canApprove ? handleReject : undefined}
            onWithdraw={handleWithdraw}
            currentUserId={currentUser?.id}
            canApprove={canApprove}
          />
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              共 {total} 条记录，第 {page} / {Math.ceil(total / pageSize)} 页
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                上一页
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / pageSize)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
