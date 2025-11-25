'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';

import PurchasesClient from '@/components/purchases/PurchasesClient';
import { usePermissions } from '@/hooks/usePermissions';

export default function PurchasesPage() {
	const { loading: permissionLoading, hasPermission } = usePermissions();

	const permissionSnapshot = useMemo(() => {
		if (permissionLoading) {
			return {
				canViewAllPurchases: false,
				canViewDepartmentPurchases: false,
				canCreatePurchase: false,
				canApprovePurchase: false,
			};
		}

		return {
			canViewAllPurchases: hasPermission('PURCHASE_VIEW_ALL'),
			canViewDepartmentPurchases: hasPermission('PURCHASE_VIEW_DEPARTMENT'),
			canCreatePurchase: hasPermission('PURCHASE_CREATE'),
			canApprovePurchase: hasPermission('PURCHASE_APPROVE'),
		};
	}, [hasPermission, permissionLoading]);

	const {
		canViewAllPurchases,
		canViewDepartmentPurchases,
		canCreatePurchase,
		canApprovePurchase,
	} = permissionSnapshot;

	const canViewPurchases = canViewAllPurchases || canViewDepartmentPurchases;
	const viewScopeLabel = canViewAllPurchases
		? '全部采购记录'
		: canViewDepartmentPurchases
			? '所在部门采购记录'
			: '—';

	const capabilityBadges = [
		{ label: '查看范围', value: viewScopeLabel },
		{ label: '可否发起采购', value: canCreatePurchase ? '可以' : '不可' },
		{ label: '可否审批 / 打款', value: canApprovePurchase ? '可以' : '不可' },
	];

	let bodyContent: ReactNode;

	if (permissionLoading) {
		bodyContent = (
			<div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
				正在加载权限信息...
			</div>
		);
	} else if (!canViewPurchases) {
		bodyContent = (
			<div className="rounded-lg border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow-sm dark:border-rose-900/60 dark:bg-gray-900 dark:text-rose-200">
				当前账户无权访问采购模块。需要 PURCHASE_VIEW_ALL 或 PURCHASE_VIEW_DEPARTMENT 权限，请联系管理员开通。
			</div>
		);
	} else {
		bodyContent = <PurchasesClient />;
	}

	return (
		<section className="space-y-6">
			{bodyContent}
		</section>
	);
}
