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
		if (!response.ok || !result.success || !result?.data?.id) {
			throw new Error(result.error || '创建采购失败');
		}

		const submitResp = await fetch(`/api/purchases/${result.data.id}/actions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'submit' }),
		});
		const submitResult = await submitResp.json().catch(() => null);
		if (!submitResp.ok || !submitResult?.success) {
			toast.warning(submitResult?.error || '采购单已保存为草稿，请在详情中手动提交审批');
			router.push('/purchases');
			router.refresh();
			return;
		}

		toast.success('采购申请已提交，等待审批');
		router.push('/purchases');
		router.refresh();
	};

	if (permissionLoading) {
		return (
			<section className="space-y-6">
				<div className="alert-box alert-info">
					正在加载权限信息...
				</div>
			</section>
		);
	}

	if (!canCreatePurchase) {
		return (
			<section className="space-y-6">
				<div className="alert-box alert-danger">
					当前账户无权发起采购。请联系管理员开通 PURCHASE_CREATE 权限。
				</div>
			</section>
		);
	}

	return (
		<section className="space-y-6">
			<div className="space-y-6">
				<div className="panel-frame">
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
