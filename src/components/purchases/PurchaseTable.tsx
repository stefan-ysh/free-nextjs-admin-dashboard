'use client';

import PurchaseStatusBadge from './PurchaseStatusBadge';
import type { PurchaseRecord, PaymentMethod } from '@/types/purchase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
	scrollAreaClassName?: string;
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
	scrollAreaClassName,
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
	const scrollContainerClassName = cn(
		'custom-scrollbar',
		scrollAreaClassName ?? 'max-h-[calc(100vh-350px)]'
	);
	return (
		<Table
			stickyHeader
			scrollAreaClassName={scrollContainerClassName}
			className="min-w-[960px] text-sm text-muted-foreground"
		>
			<TableHeader>
				<TableRow className="bg-muted/60">
					<TableHead className="px-4 py-3 uppercase tracking-wide">采购单号 / 物品</TableHead>
					<TableHead className="px-4 py-3 uppercase tracking-wide">金额</TableHead>
					<TableHead className="px-4 py-3 uppercase tracking-wide">状态</TableHead>
					<TableHead className="px-4 py-3 uppercase tracking-wide">采购日期</TableHead>
					<TableHead className="px-4 py-3 uppercase tracking-wide">付款方式</TableHead>
					<TableHead className="px-4 py-3 text-right uppercase tracking-wide">操作</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{loading ? (
					<TableRow>
						<TableCell colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
							<Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> 正在加载采购数据...
						</TableCell>
					</TableRow>
				) : purchases.length === 0 ? (
					<TableRow>
						<TableCell colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
							暂无数据，尝试调整筛选条件。
						</TableCell>
					</TableRow>
				) : (
					purchases.map((purchase) => {
						const permissions = getRowPermissions(purchase);
						const rowBusy = mutatingId === purchase.id;
						return (
							<TableRow key={purchase.id} className="text-foreground">
								<TableCell className="px-4 py-4 text-sm text-foreground whitespace-normal">
									<div className="font-semibold text-foreground">{purchase.purchaseNumber}</div>
									<div className="text-xs text-muted-foreground">{purchase.itemName}</div>
								</TableCell>
								<TableCell className="px-4 py-4 font-semibold text-foreground">
									{currencyFormatter.format(purchase.totalAmount)}
								</TableCell>
								<TableCell className="px-4 py-4">
									<PurchaseStatusBadge status={purchase.status} />
								</TableCell>
								<TableCell className="px-4 py-4 text-muted-foreground whitespace-normal">
									{formatDate(purchase.purchaseDate)}
								</TableCell>
								<TableCell className="px-4 py-4 text-muted-foreground whitespace-normal">
									{paymentLabels[purchase.paymentMethod] ?? purchase.paymentMethod}
								</TableCell>
								<TableCell className="px-4 py-4 text-right">
									<div className="flex flex-wrap justify-end gap-2 text-xs">
										<button
											onClick={() => onView(purchase)}
											className="rounded-lg border border-border px-3 py-1 text-foreground hover:bg-muted/50"
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
												className="rounded-lg border border-border px-3 py-1 text-muted-foreground hover:bg-muted/50 disabled:opacity-60"
											>
												删除
											</button>
										)}
									</div>
								</TableCell>
							</TableRow>
						);
					})
				)}
			</TableBody>
		</Table>
	);
}

export type { PurchaseRowPermissions };
