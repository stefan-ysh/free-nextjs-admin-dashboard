'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import PurchaseForm, { type PurchaseFormSubmitPayload } from '@/components/purchases/PurchaseForm';
import PurchaseStatusBadge from '@/components/purchases/PurchaseStatusBadge';
import { usePermissions } from '@/hooks/usePermissions';
import { canEditPurchase } from '@/lib/permissions';
import type { PurchaseRecord } from '@/types/purchase';
import { getPurchaseStatusText } from '@/types/purchase';
import { formatDateTimeLocal } from '@/lib/dates';

type PurchaseResponse = {
	success: boolean;
	data?: PurchaseRecord;
	error?: string;
};

export default function PurchaseEditPage() {
	const params = useParams<{ id?: string }>();
	const purchaseId = typeof params?.id === 'string' ? params.id : '';
	const router = useRouter();
	const { user: permissionUser, loading: permissionLoading, hasPermission } = usePermissions();
	const [purchase, setPurchase] = useState<PurchaseRecord | null>(null);
	const [fetchError, setFetchError] = useState<string | null>(null);
	const [fetching, setFetching] = useState(false);

	const permissionSnapshot = useMemo(() => {
		if (permissionLoading) {
			return { canUpdate: false, canApprove: false };
		}
		return {
			canUpdate: hasPermission('PURCHASE_UPDATE'),
			canApprove: hasPermission('PURCHASE_APPROVE'),
		};
	}, [hasPermission, permissionLoading]);

	const baseAccessGranted = permissionSnapshot.canUpdate || permissionSnapshot.canApprove;

	useEffect(() => {
		if (!purchaseId || !baseAccessGranted) return;
		let cancelled = false;

		const loadPurchase = async () => {
			setFetching(true);
			setFetchError(null);
			try {
				const response = await fetch(`/api/purchases/${purchaseId}`);
				const payload = (await response.json()) as PurchaseResponse;
				if (!response.ok || !payload.success || !payload.data) {
					throw new Error(payload.error || '获取采购详情失败');
				}
				if (cancelled) return;
				setPurchase(payload.data);
			} catch (error) {
				if (cancelled) return;
				setFetchError(error instanceof Error ? error.message : '获取采购详情失败');
				setPurchase(null);
			} finally {
				if (!cancelled) setFetching(false);
			}
		};

		loadPurchase();
		return () => {
			cancelled = true;
		};
	}, [purchaseId, baseAccessGranted]);

	const canEditRecord = useMemo(() => {
		if (!purchase || !permissionUser) return false;
		return canEditPurchase(permissionUser, {
			createdBy: purchase.createdBy,
			status: purchase.status,
		});
	}, [permissionUser, purchase]);

	const handleUpdate = async (payload: PurchaseFormSubmitPayload) => {
		if (!purchaseId) {
			throw new Error('无效的采购 ID');
		}
		const response = await fetch(`/api/purchases/${purchaseId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		const result = await response.json();
		if (!response.ok || !result.success) {
			throw new Error(result.error || '更新采购失败');
		}
		toast.success('采购记录已更新');
		router.push('/purchases');
		router.refresh();
	};

	if (!purchaseId) {
		return (
			<section className="space-y-6">
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
					未提供正确的采购 ID，无法定位记录。
				</div>
			</section>
		);
	}

	if (permissionLoading) {
		return (
			<section className="space-y-6">
				<div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
					正在加载权限信息...
				</div>
			</section>
		);
	}

	if (!baseAccessGranted) {
		return (
			<section className="space-y-6">
				<div className="rounded-lg border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow-sm dark:border-rose-900/60 dark:bg-gray-900 dark:text-rose-200">
					当前账户无权编辑或审批采购记录。请联系管理员开通相应权限。
				</div>
			</section>
		);
	}

	return (
		<section className="space-y-6">
			{fetching && (
				<div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
					正在加载采购详情...
				</div>
			)}
			{fetchError && !fetching && (
				<div className="rounded-lg border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow-sm dark:border-rose-900/60 dark:bg-gray-900 dark:text-rose-200">
					{fetchError}
				</div>
			)}
			{!fetching && !fetchError && purchase && (
				<div className="space-y-6">
					<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
						<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
							<div>
								<p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">采购单号</p>
								<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{purchase.purchaseNumber}</h2>
								<div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
									<span>状态：<PurchaseStatusBadge status={purchase.status} /></span>
									<span>金额：¥{purchase.totalAmount.toFixed(2)}</span>
									<span>最近更新：{formatDateTimeLocal(purchase.updatedAt) ?? purchase.updatedAt}</span>
								</div>
							</div>
							<div className="text-sm text-gray-500 dark:text-gray-400">
								<span className="font-medium text-gray-700 dark:text-gray-200">当前阶段：</span>
								{getPurchaseStatusText(purchase.status)}
							</div>
						</div>
					</div>

					{canEditRecord ? (
						<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
							<PurchaseForm
								mode="edit"
								initialData={purchase}
								currentUserId={permissionUser?.id ?? ''}
								onSubmit={handleUpdate}
								onCancel={() => router.push('/purchases')}
							/>
						</div>
					) : (
						<div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
							仅草稿或被驳回的采购单可编辑，且需由提交人操作。若需调整已审批中的记录，请联系管理员协助。
						</div>
					)}
				</div>
			)}
		</section>
	);
}
