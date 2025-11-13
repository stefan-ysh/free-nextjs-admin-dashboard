'use client';

import { useRouter } from 'next/navigation';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import PurchaseForm from '@/components/purchases/PurchaseForm';
import { CreatePurchaseInput } from '@/types/purchase';

export default function NewPurchasePage() {
  const router = useRouter();

  const handleSubmit = async (data: CreatePurchaseInput) => {
    try {
      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建失败');
      }

      const result = await response.json();
      if (result.success) {
        alert('创建成功！');
        router.push('/purchases');
      }
    } catch (error: unknown) {
      console.error('创建采购失败', error);
      const message = error instanceof Error ? error.message : '创建失败，请重试';
      alert(message);
      throw error;
    }
  };

  return (
    <>
      <PageBreadCrumb pageTitle="新增采购" />

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 p-6 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">创建采购记录</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            填写以下信息创建采购垫付记录
          </p>
        </div>

        <div className="p-6">
          <PurchaseForm
            onSubmit={handleSubmit}
            onCancel={() => router.push('/purchases')}
          />
        </div>
      </div>
    </>
  );
}
