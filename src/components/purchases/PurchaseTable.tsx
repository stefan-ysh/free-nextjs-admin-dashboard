'use client';

import PurchaseStatusBadge from './PurchaseStatusBadge';
import type { PurchaseRecord, PaymentMethod } from '@/types/purchase';

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
	style: 'currency',
	currency: 'CNY',
});

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
});

const paymentLabels: Record<PaymentMethod, string> = {
	wechat: '微信',
	alipay: '支付宝',
	bank_transfer: '银行转账',
	corporate_transfer: '对公转账',
	cash: '现金',
};

type PurchaseRowPermissions = {
	canEdit: boolean;
	canDelete: boolean;
	canSubmit: boolean;
	canApprove: boolean;
	canReject: boolean;
	canPay: boolean;
	canWithdraw: boolean;
};

type PurchaseTableProps = {
	purchases: PurchaseRecord[];
	loading?: boolean;
	mutatingId?: string | null;
	getRowPermissions: (purchase: PurchaseRecord) => PurchaseRowPermissions;
	onView: (purchase: PurchaseRecord) => void;
	onEdit: (purchase: PurchaseRecord) => void;
	onDelete: (purchase: PurchaseRecord) => void;
	onSubmit: (purchase: PurchaseRecord) => void;
	onApprove: (purchase: PurchaseRecord) => void;
	onReject: (purchase: PurchaseRecord) => void;
	onWithdraw: (purchase: PurchaseRecord) => void;
	onPay: (purchase: PurchaseRecord) => void;
};

function formatDate(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export default function PurchaseTable({
	purchases,
	loading,
	mutatingId,
	getRowPermissions,
	onView,
	onEdit,
	onDelete,
	onSubmit,
	onApprove,
	onReject,
	onWithdraw,
	onPay,
}: PurchaseTableProps) {
	return (
		<div className="overflow-x-auto">
			<table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
				<thead className="bg-gray-50 dark:bg-gray-900/50">
					<tr>
						<th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">采购单号 / 物品</th>
						<th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">金额</th>
						<th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">状态</th>
						<th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">采购日期</th>
						<th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">付款方式</th>
						<th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">操作</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-gray-100 dark:divide-gray-800">
					{!loading && purchases.length === 0 && (
						<tr>
							<td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
								暂无数据，尝试调整筛选条件。
							</td>
						</tr>
					)}
					{purchases.map((purchase) => {
						const permissions = getRowPermissions(purchase);
						const rowBusy = mutatingId === purchase.id;
						return (
							<tr key={purchase.id} className="bg-white transition hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800">
								<td className="whitespace-nowrap px-4 py-4">
									<div className="font-semibold text-gray-900 dark:text-gray-100">{purchase.purchaseNumber}</div>
									<div className="text-xs text-gray-500 dark:text-gray-400">{purchase.itemName}</div>
								</td>
								<td className="px-4 py-4 font-semibold text-gray-900 dark:text-gray-100">
									{currencyFormatter.format(purchase.totalAmount)}
								</td>
								<td className="px-4 py-4">
									<PurchaseStatusBadge status={purchase.status} />
								</td>
								<td className="px-4 py-4 text-gray-700 dark:text-gray-200">
									{formatDate(purchase.purchaseDate)}
								</td>
								<td className="px-4 py-4 text-gray-700 dark:text-gray-200">
									{paymentLabels[purchase.paymentMethod] ?? purchase.paymentMethod}
								</td>
								<td className="px-4 py-4">
									<div className="flex flex-wrap gap-2 text-xs">
										<button
											onClick={() => onView(purchase)}
											className="rounded-lg border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200"
										>
											详情
										</button>
										{permissions.canEdit && (
											<button
												onClick={() => onEdit(purchase)}
												disabled={rowBusy}
												className="rounded-lg border border-blue-500 px-3 py-1 text-blue-600 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-400 dark:text-blue-200"
											>
												编辑
											</button>
										)}
										{permissions.canSubmit && (
											<button
												onClick={() => onSubmit(purchase)}
												disabled={rowBusy}
												className="rounded-lg border border-emerald-500 px-3 py-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-400 dark:text-emerald-200"
											>
												提交
											</button>
										)}
										{permissions.canWithdraw && (
											<button
												onClick={() => onWithdraw(purchase)}
												disabled={rowBusy}
												className="rounded-lg border border-amber-500 px-3 py-1 text-amber-600 hover:bg-amber-50 disabled:opacity-60 dark:border-amber-400 dark:text-amber-200"
											>
												撤回
											</button>
										)}
										{permissions.canApprove && (
											<button
												onClick={() => onApprove(purchase)}
												disabled={rowBusy}
												className="rounded-lg border border-indigo-500 px-3 py-1 text-indigo-600 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-400 dark:text-indigo-200"
											>
												审批
											</button>
										)}
										{permissions.canReject && (
											<button
												onClick={() => onReject(purchase)}
												disabled={rowBusy}
												className="rounded-lg border border-rose-500 px-3 py-1 text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-400 dark:text-rose-200"
											>
												驳回
											</button>
										)}
										{permissions.canPay && (
											<button
												onClick={() => onPay(purchase)}
												disabled={rowBusy}
												className="rounded-lg border border-purple-500 px-3 py-1 text-purple-600 hover:bg-purple-50 disabled:opacity-60 dark:border-purple-400 dark:text-purple-200"
											>
												打款
											</button>
										)}
										{permissions.canDelete && (
											<button
												onClick={() => onDelete(purchase)}
												disabled={rowBusy}
												className="rounded-lg border border-gray-300 px-3 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-300"
											>
												删除
											</button>
										)}
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

export type { PurchaseRowPermissions };
