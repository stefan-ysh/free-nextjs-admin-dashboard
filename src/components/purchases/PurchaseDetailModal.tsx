'use client';

import { useEffect, type ReactNode } from 'react';

import PurchaseApprovalFlow from './PurchaseApprovalFlow';
import PurchaseStatusBadge from './PurchaseStatusBadge';
import type { PurchaseRowPermissions } from './PurchaseTable';
import type { PurchaseDetail, PurchaseRecord } from '@/types/purchase';

type PurchaseDetailModalProps = {
	purchase: PurchaseDetail | null;
	onClose: () => void;
	permissions?: PurchaseRowPermissions;
	busy?: boolean;
	detailLoading?: boolean;
	detailError?: string | null;
	onReloadDetail?: () => void;
	onSubmit?: (purchase: PurchaseRecord) => void;
	onWithdraw?: (purchase: PurchaseRecord) => void;
	onApprove?: (purchase: PurchaseRecord) => void;
	onReject?: (purchase: PurchaseRecord) => void;
	onPay?: (purchase: PurchaseRecord) => void;
};

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
	style: 'currency',
	currency: 'CNY',
});

const dateDisplayFormatter = new Intl.DateTimeFormat('zh-CN', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
});

const CHANNEL_LABELS: Record<PurchaseDetail['purchaseChannel'], string> = {
	online: '线上',
	offline: '线下',
};

const PAYMENT_LABELS: Record<PurchaseDetail['paymentMethod'], string> = {
	wechat: '微信',
	alipay: '支付宝',
	bank_transfer: '银行转账',
	corporate_transfer: '对公转账',
	cash: '现金',
};

const PAYMENT_TYPE_LABELS: Record<PurchaseDetail['paymentType'], string> = {
	deposit: '定金',
	full: '全款',
	installment: '分期',
	balance: '尾款',
	other: '其他',
};

const INVOICE_TYPE_LABELS: Record<PurchaseDetail['invoiceType'], string> = {
	special: '增值税专票',
	general: '普通发票',
	none: '无需发票',
};

const INVOICE_STATUS_LABELS: Record<PurchaseDetail['invoiceStatus'], string> = {
	issued: '已开票',
	pending: '待开票',
	not_required: '无需开票',
};

function parseDateValue(value: string | null): Date | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	const isoLike = trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed;
	const parsed = new Date(isoLike);
	if (!Number.isNaN(parsed.getTime())) {
		return parsed;
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		const fallback = new Date(`${trimmed}T00:00:00`);
		if (!Number.isNaN(fallback.getTime())) {
			return fallback;
		}
	}
	return null;
}

function formatDate(value: string | null): string {
	const date = parseDateValue(value);
	if (!date) return value ?? '—';
	return dateDisplayFormatter.format(date);
}

function resolveUserName(user: PurchaseDetail['approver'] | PurchaseDetail['rejecter'] | PurchaseDetail['payer']): string {
	return user?.displayName ?? user?.id ?? '—';
}

function resolvePurchaser(purchase: PurchaseDetail): string {
	return purchase.purchaser.displayName || purchase.purchaser.id;
}

export default function PurchaseDetailModal({
	purchase,
	onClose,
	permissions,
	busy,
	onSubmit,
	onWithdraw,
	onApprove,
	onReject,
	onPay,
	detailLoading,
	detailError,
	onReloadDetail,
}: PurchaseDetailModalProps) {
	useEffect(() => {
		if (!purchase) return undefined;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [purchase]);

	if (!purchase) return null;

	const infoRows: Array<{ label: string; value: string | number | ReactNode }> = [
		{ label: '采购单号', value: purchase.purchaseNumber },
		{ label: '采购日期', value: formatDate(purchase.purchaseDate) },
		{ label: '物品名称', value: purchase.itemName },
		{ label: '规格/型号', value: purchase.specification ?? '—' },
		{ label: '数量', value: purchase.quantity },
		{ label: '单价', value: currencyFormatter.format(purchase.unitPrice) },
		{ label: '合同金额', value: currencyFormatter.format(purchase.totalAmount) },
		{ label: '手续费', value: currencyFormatter.format(purchase.feeAmount ?? 0) },
		{
			label: '总金额（含手续费）',
			value: currencyFormatter.format(purchase.totalAmount + (purchase.feeAmount ?? 0)),
		},
		{ label: '采购渠道', value: CHANNEL_LABELS[purchase.purchaseChannel] },
		{ label: '付款方式', value: PAYMENT_LABELS[purchase.paymentMethod] },
		{ label: '款项类型', value: PAYMENT_TYPE_LABELS[purchase.paymentType] },
		{ label: '支付方式 / 通道', value: purchase.paymentChannel ?? '—' },
		{ label: '代付人', value: purchase.payerName ?? '—' },
		{ label: '支付流水号', value: purchase.transactionNo ?? '—' },
		{ label: '申请人', value: resolvePurchaser(purchase) },
		{ label: '申请人部门', value: purchase.purchaser.department ?? '—' },
		{ label: '申请人工号', value: purchase.purchaser.employeeCode ?? '—' },
		{ label: '关联项目', value: purchase.project ? `${purchase.project.projectName}（${purchase.project.projectCode}）` : '—' },
		{ label: '发票类型', value: INVOICE_TYPE_LABELS[purchase.invoiceType] },
		{ label: '开票状态', value: INVOICE_STATUS_LABELS[purchase.invoiceStatus] },
		{ label: '发票号码', value: purchase.invoiceNumber ?? '—' },
		{ label: '开票日期', value: formatDate(purchase.invoiceIssueDate) },
		{ label: '流程状态', value: <PurchaseStatusBadge status={purchase.status} /> },
		{ label: '提交时间', value: formatDate(purchase.submittedAt) },
		{ label: '批准时间', value: formatDate(purchase.approvedAt) },
		{ label: '审批人', value: resolveUserName(purchase.approver) },
		{ label: '驳回时间', value: formatDate(purchase.rejectedAt) },
		{ label: '驳回人', value: resolveUserName(purchase.rejecter) },
		{ label: '驳回原因', value: purchase.rejectionReason ?? '—' },
		{ label: '打款时间', value: formatDate(purchase.paidAt) },
		{ label: '打款人', value: resolveUserName(purchase.payer) },
		{ label: '备注', value: purchase.notes ?? '—' },
	];

	return (
		<div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
			<button
				type="button"
				className="absolute inset-0 h-full w-full bg-black/50 backdrop-blur-sm"
				onClick={onClose}
				aria-label="关闭采购详情"
			/>
			<div className="relative z-10 flex h-full w-full items-center justify-center px-4 py-6">
				<div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
					<div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
						<div>
							<p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">采购详情</p>
							<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{purchase.itemName}</h3>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300"
						>
							关闭
						</button>
					</div>
					<div className="space-y-6 px-6 py-5">
						{detailLoading && (
							<div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
								正在同步最新审批状态...
							</div>
						)}
						{detailError && (
							<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
								<span>{detailError}</span>
								{onReloadDetail && (
									<button
										type="button"
										onClick={onReloadDetail}
										className="rounded border border-rose-400 px-2 py-1 text-rose-600 hover:bg-rose-100 dark:border-rose-300 dark:text-rose-100"
									>
										重试
									</button>
								)}
							</div>
						)}
						<div className="grid gap-6 lg:grid-cols-12">
							<div className="space-y-6 lg:col-span-7">
								<div className="grid gap-4 md:grid-cols-2">
									{infoRows.map((row) => (
										<div key={row.label} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
											<p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{row.label}</p>
											<div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">{row.value}</div>
										</div>
									))}
								</div>
								<div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
									<p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">采购用途</p>
									<p className="mt-2 text-sm text-gray-800 dark:text-gray-200">{purchase.purpose}</p>
								</div>
								{(purchase.attachments.length || purchase.invoiceImages.length || purchase.receiptImages.length) ? (
									<div className="grid gap-4 md:grid-cols-3">
										{[
											{ label: '附件', items: purchase.attachments },
											{ label: '发票', items: purchase.invoiceImages },
											{ label: '收据', items: purchase.receiptImages },
										].map((group) => (
											<div key={group.label} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
												<p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{group.label}</p>
												{group.items.length ? (
													<ul className="mt-2 space-y-1 text-xs text-blue-600 dark:text-blue-300">
														{group.items.map((item, index) => (
															<li key={`${group.label}-${index}`} className="truncate">
																<a href={item} target="_blank" rel="noreferrer" className="hover:underline">
																	{item}
																</a>
															</li>
														))}
													</ul>
												) : (
													<p className="mt-2 text-xs text-gray-500 dark:text-gray-400">暂无</p>
												)}
											</div>
										))}
									</div>
								) : null}
							</div>
							<div className="lg:col-span-5">
								<PurchaseApprovalFlow
									purchase={purchase}
									permissions={permissions}
									onSubmit={onSubmit}
									onWithdraw={onWithdraw}
									onApprove={onApprove}
									onReject={onReject}
									onPay={onPay}
									busy={busy}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
