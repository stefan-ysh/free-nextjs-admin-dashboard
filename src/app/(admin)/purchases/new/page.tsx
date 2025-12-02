'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import PurchaseForm, { type PurchaseFormSubmitPayload } from '@/components/purchases/PurchaseForm';
import { usePermissions } from '@/hooks/usePermissions';

export default function PurchaseCreatePage() {
	const router = useRouter();
	const { user, loading: permissionLoading, hasPermission } = usePermissions();
	const canCreatePurchase = useMemo(
		() => !permissionLoading && hasPermission('PURCHASE_CREATE'),
		[hasPermission, permissionLoading]
	);

	const handleCreate = async (payload: PurchaseFormSubmitPayload) => {
		const response = await fetch('/api/purchases', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		const result = await response.json();
		if (!response.ok || !result.success) {
			throw new Error(result.error || '创建采购失败');
		}
		toast.success('采购草稿已保存');
		router.push('/purchases');
		router.refresh();
	};

	if (permissionLoading) {
		return (
			<section className="space-y-6">
				<div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
					正在加载权限信息...
				</div>
			</section>
		);
	}

	if (!canCreatePurchase) {
		return (
			<section className="space-y-6">
				<div className="rounded-lg border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow-sm dark:border-rose-900/60 dark:bg-gray-900 dark:text-rose-200">
					当前账户无权发起采购。请联系管理员开通 PURCHASE_CREATE 权限。
				</div>
			</section>
		);
	}

	return (
		<section className="space-y-6">
			<div className="space-y-6">
				<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
					<PurchaseForm
						mode="create"
						currentUserId={user?.id ?? ''}
						onSubmit={handleCreate}
						onCancel={() => router.push('/purchases')}
					/>
				</div>
			</div>
		</section>
	);
}
