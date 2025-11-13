'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import PurchaseForm from '@/components/purchases/PurchaseForm';
import { CreatePurchaseInput, PurchaseRecord } from '@/types/purchase';

export default function EditPurchasePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [purchase, setPurchase] = useState<PurchaseRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPurchase = async () => {
      try {
        const response = await fetch(`/api/purchases/${id}`);
        if (!response.ok) throw new Error('Failed to fetch');
        
        const result = await response.json();
        if (result.success) {
          setPurchase(result.data);
        }
      } catch (error) {
        console.error('加载采购失败', error);
        alert('加载失败');
        router.push('/purchases');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchase();
  }, [id, router]);

  const handleSubmit = async (data: CreatePurchaseInput) => {
    try {
      const response = await fetch(`/api/purchases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新失败');
      }

      const result = await response.json();
      if (result.success) {
        alert('更新成功！');
        router.push('/purchases');
      }
    } catch (error: any) {
      console.error('更新采购失败', error);
      alert(error.message || '更新失败，请重试');
      throw error;
    }
  };

  if (loading) {
    return (
      <>
        <PageBreadCrumb pageTitle="编辑采购" />
        <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="text-gray-500 dark:text-gray-400">加载中...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageBreadCrumb pageTitle="编辑采购" />

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 p-6 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">编辑采购记录</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            修改采购信息（仅草稿和已驳回状态可编辑）
          </p>
        </div>

        <div className="p-6">
          <PurchaseForm
            initialData={purchase}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/purchases')}
          />
        </div>
      </div>
    </>
  );
}
