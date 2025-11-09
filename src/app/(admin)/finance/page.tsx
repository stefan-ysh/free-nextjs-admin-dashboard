'use client';

import { useState, useEffect } from 'react';
import { FinanceRecord, TransactionType, FinanceStats } from '@/types/finance';
import FinanceForm from '@/components/finance/FinanceForm';
import FinanceTable from '@/components/finance/FinanceTable';
import FinanceStatsCards from '@/components/finance/FinanceStatsCards';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';

export default function FinancePage() {
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [categories, setCategories] = useState<{ income: string[]; expense: string[] }>({
    income: [],
    expense: [],
  });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 获取分类
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const [incomeRes, expenseRes] = await Promise.all([
          fetch(`/api/finance/categories?type=${TransactionType.INCOME}`),
          fetch(`/api/finance/categories?type=${TransactionType.EXPENSE}`),
        ]);

        if (incomeRes.ok && expenseRes.ok) {
          const incomeData = await incomeRes.json();
          const expenseData = await expenseRes.json();
          setCategories({
            income: incomeData.data || [],
            expense: expenseData.data || [],
          });
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchCategories();
  }, []);

  // 获取记录列表
  const fetchRecords = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/records?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/finance/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchStats();
  }, []);

  // 创建记录
  const handleCreate = async (data: Omit<FinanceRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const res = await fetch('/api/finance/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setShowForm(false);
        fetchRecords(currentPage);
        fetchStats();
      } else {
        const error = await res.json();
        alert(error.error || '创建失败');
      }
    } catch (error) {
      console.error('Error creating record:', error);
      alert('创建失败,请重试');
    }
  };

  // 更新记录
  const handleUpdate = async (data: Omit<FinanceRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editingRecord) return;

    try {
      const res = await fetch(`/api/finance/records/${editingRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setEditingRecord(null);
        fetchRecords(currentPage);
        fetchStats();
      } else {
        const error = await res.json();
        alert(error.error || '更新失败');
      }
    } catch (error) {
      console.error('Error updating record:', error);
      alert('更新失败,请重试');
    }
  };

  // 删除记录
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/records/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchRecords(currentPage);
        fetchStats();
      } else {
        alert('删除失败');
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('删除失败,请重试');
    }
  };

  const handleEdit = (record: FinanceRecord) => {
    setEditingRecord(record);
    setShowForm(false);
  };

  return (
    <>
      <PageBreadCrumb pageTitle="财务管理" />

      <div className="space-y-6">
        {/* 统计卡片 */}
        <FinanceStatsCards stats={stats} loading={loading && !stats} />

        {/* 表单区域 */}
        {(showForm || editingRecord) && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
              {editingRecord ? '编辑记录' : '添加记录'}
            </h2>
            <FinanceForm
              initialData={editingRecord || undefined}
              onSubmit={editingRecord ? handleUpdate : handleCreate}
              onCancel={() => {
                setShowForm(false);
                setEditingRecord(null);
              }}
              incomeCategories={categories.income}
              expenseCategories={categories.expense}
            />
          </div>
        )}

        {/* 记录列表 */}
        <div className="rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">财务记录</h2>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingRecord(null);
              }}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              + 添加记录
            </button>
          </div>

          <FinanceTable
            records={records}
            onEdit={handleEdit}
            onDelete={handleDelete}
            loading={loading}
          />

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 p-6 dark:border-gray-700">
              <div className="text-sm text-gray-700 dark:text-gray-400">
                第 {currentPage} / {totalPages} 页
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchRecords(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  上一页
                </button>
                <button
                  onClick={() => fetchRecords(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
