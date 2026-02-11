'use client';

import PurchaseStatusBadge from './PurchaseStatusBadge';
import type { PurchaseRecord, PaymentMethod, PurchaseOrganization } from '@/types/purchase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DataState from '@/components/common/DataState';
import { cn } from '@/lib/utils';
import { formatDateOnly } from '@/lib/dates';

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
	style: 'currency',
	currency: 'CNY',
});

const paymentLabels: Record<PaymentMethod, string> = {
	wechat: '微信',
	alipay: '支付宝',
	bank_transfer: '银行转账',
	corporate_transfer: '对公转账',
	cash: '现金',
};

const organizationLabels: Record<PurchaseOrganization, string> = {
	school: '学校',
	company: '单位',
};

type PurchaseRowPermissions = {
	canEdit: boolean;
	canDelete: boolean;
	canDuplicate: boolean;
	canSubmit: boolean;
	canApprove: boolean;
	canTransfer: boolean;
	canReject: boolean;
	canPay: boolean;
	canSubmitReimbursement: boolean;
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
	onDuplicate: (purchase: PurchaseRecord) => void;
	onDelete: (purchase: PurchaseRecord) => void;
	onSubmit: (purchase: PurchaseRecord) => void;
	onApprove: (purchase: PurchaseRecord) => void;
	onTransfer: (purchase: PurchaseRecord) => void;
	onReject: (purchase: PurchaseRecord) => void;
	onWithdraw: (purchase: PurchaseRecord) => void;
	onPay: (purchase: PurchaseRecord) => void;
	onSubmitReimbursement: (purchase: PurchaseRecord) => void;
	getRowClassName?: (purchase: PurchaseRecord) => string;
};

function formatDate(value: string): string {
	return formatDateOnly(value) ?? value;
}

export default function PurchaseTable({
	purchases,
	loading,
	mutatingId,
	scrollAreaClassName,
	getRowPermissions,
	onView,
	onEdit,
	onDuplicate,
	onDelete,
	onSubmit,
	onApprove,
	onTransfer,
	onReject,
	onWithdraw,
	onPay,
	onSubmitReimbursement,
	getRowClassName,
}: PurchaseTableProps) {
	const scrollContainerClassName = cn(
		'custom-scrollbar',
		scrollAreaClassName ?? 'max-h-[calc(100vh-350px)]'
	);
	if (loading) {
		return (
			<div className="surface-table p-6">
				<DataState
					variant="loading"
					title="正在加载采购数据"
					description="请稍候片刻，数据正在同步中"
				/>
			</div>
		);
	}

	if (purchases.length === 0) {
		return (
			<div className="surface-table p-6">
				<DataState
					variant="empty"
					title="暂无采购记录"
					description="尝试调整筛选条件或点击“发起采购”新增记录"
				/>
			</div>
		);
	}

	return (
		<div className="surface-table">
			<div className="md:hidden">
				<div className="space-y-3 p-4">
					{purchases.map((purchase) => {
						const permissions = getRowPermissions(purchase);
						const rowBusy = mutatingId === purchase.id;
						const rowClassName = getRowClassName?.(purchase);
						return (
							<div key={purchase.id} className={cn("rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm", rowClassName)}>
								<div className="flex items-start justify-between gap-3">
									<div>
										<div className="text-sm font-semibold text-foreground">{purchase.itemName}</div>
										<div className="mt-1 text-xs text-muted-foreground">单号：{purchase.purchaseNumber}</div>
									</div>
									<PurchaseStatusBadge status={purchase.status} />
								</div>
								<div className="mt-3 grid gap-2 text-xs text-muted-foreground">
									<div className="flex items-center justify-between gap-3">
										<span>金额</span>
										<span className="text-foreground">{currencyFormatter.format(purchase.totalAmount)}</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span>采购日期</span>
										<span className="text-foreground">{formatDate(purchase.purchaseDate)}</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span>采购组织</span>
										<span className="text-foreground">
											{organizationLabels[purchase.organizationType] ?? purchase.organizationType}
										</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span>付款方式</span>
										<span className="text-foreground">{paymentLabels[purchase.paymentMethod] ?? purchase.paymentMethod}</span>
									</div>
								</div>
								<div className="mt-4 flex flex-wrap justify-end gap-2 text-xs">
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
									{permissions.canDuplicate && (
										<button
											onClick={() => onDuplicate(purchase)}
											disabled={rowBusy}
											className="rounded-lg border border-indigo-500 px-3 py-1 text-indigo-600 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-400 dark:text-indigo-200"
										>
											复制
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
									{permissions.canTransfer && (
										<button
											onClick={() => onTransfer(purchase)}
											disabled={rowBusy}
											className="rounded-lg border border-slate-500 px-3 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-400 dark:text-slate-200"
										>
											转审
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
									{permissions.canSubmitReimbursement && (
										<button
											onClick={() => onSubmitReimbursement(purchase)}
											disabled={rowBusy}
											className="rounded-lg border border-cyan-500 px-3 py-1 text-cyan-600 hover:bg-cyan-50 disabled:opacity-60 dark:border-cyan-400 dark:text-cyan-200"
										>
											提交报销
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
							</div>
						);
					})}
				</div>
			</div>
			<div className="hidden md:block">
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
							<TableHead className="px-4 py-3 uppercase tracking-wide">组织</TableHead>
							<TableHead className="px-4 py-3 uppercase tracking-wide">采购日期</TableHead>
							<TableHead className="px-4 py-3 uppercase tracking-wide">付款方式</TableHead>
							<TableHead className="px-4 py-3 text-right uppercase tracking-wide">操作</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{purchases.map((purchase) => {
							const permissions = getRowPermissions(purchase);
							const rowBusy = mutatingId === purchase.id;
							const rowClassName = getRowClassName?.(purchase);
							return (
								<TableRow key={purchase.id} className={cn("text-foreground", rowClassName)}>
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
										{organizationLabels[purchase.organizationType] ?? purchase.organizationType}
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
											{permissions.canDuplicate && (
												<button
													onClick={() => onDuplicate(purchase)}
													disabled={rowBusy}
													className="rounded-lg border border-indigo-500 px-3 py-1 text-indigo-600 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-400 dark:text-indigo-200"
												>
													复制
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
											{permissions.canTransfer && (
												<button
													onClick={() => onTransfer(purchase)}
													disabled={rowBusy}
													className="rounded-lg border border-slate-500 px-3 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-400 dark:text-slate-200"
												>
													转审
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
											{permissions.canSubmitReimbursement && (
												<button
													onClick={() => onSubmitReimbursement(purchase)}
													disabled={rowBusy}
													className="rounded-lg border border-cyan-500 px-3 py-1 text-cyan-600 hover:bg-cyan-50 disabled:opacity-60 dark:border-cyan-400 dark:text-cyan-200"
												>
													提交报销
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
						})}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

export type { PurchaseRowPermissions };
