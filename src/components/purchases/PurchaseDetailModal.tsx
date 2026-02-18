'use client';

import { useEffect, useState, type ReactNode } from 'react';

import ModalShell from '@/components/common/ModalShell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import PurchaseApprovalFlow from './PurchaseApprovalFlow';
import PurchaseStatusBadge from './PurchaseStatusBadge';
import type { PurchaseRowPermissions } from './PurchaseTable';
import { getReimbursementStatusText } from '@/types/purchase';
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
	onTransfer?: (purchase: PurchaseRecord) => void;
	onReject?: (purchase: PurchaseRecord) => void;
	onPay?: (purchase: PurchaseRecord) => void;
	onSubmitReimbursement?: (purchase: PurchaseRecord) => void;
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

const ORGANIZATION_LABELS: Record<PurchaseDetail['organizationType'], string> = {
	school: '学校',
	company: '单位',
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

const dateTimeDisplayFormatter = new Intl.DateTimeFormat('zh-CN', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
});

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

function formatDateTime(value: string | null): string {
	const date = parseDateValue(value);
	if (!date) return value ?? '—';
	return dateTimeDisplayFormatter.format(date);
}

function resolveUserName(user: PurchaseDetail['approver'] | PurchaseDetail['rejecter'] | PurchaseDetail['payer']): string {
	return user?.displayName ?? '未知用户';
}

function resolvePurchaser(purchase: PurchaseDetail): string {
	return purchase.purchaser.displayName || '未知用户';
}

type InfoRow = { label: string; value: ReactNode };

type InfoSectionConfig = {
	title: string;
	rows: InfoRow[];
	columns?: 1 | 2 | 3;
};

const columnClassMap: Record<NonNullable<InfoSectionConfig['columns']>, string> = {
	1: 'md:grid-cols-1',
	2: 'md:grid-cols-2',
	3: 'md:grid-cols-3',
};

function InfoSection({ title, rows, columns = 2 }: InfoSectionConfig) {
	return (
		<section className="surface-panel">
			<div className="border-b px-5 py-4">
				<p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
			</div>
			<div className={cn('grid gap-4 px-5 py-5', columnClassMap[columns])}>
				{rows.map((row) => (
					<div key={row.label} className="rounded-xl border bg-background/50 px-4 py-3">
						<p className="text-xs text-muted-foreground">{row.label}</p>
						<div className="mt-1 text-sm font-medium text-foreground">{row.value}</div>
					</div>
				))}
			</div>
		</section>
	);
}

export default function PurchaseDetailModal({
	purchase,
	onClose,
	permissions,
	busy,
	onSubmit,
	onWithdraw,
	onApprove,
	onTransfer,
	onReject,
	onPay,
	onSubmitReimbursement,
	detailLoading,
	detailError,
	onReloadDetail,
}: PurchaseDetailModalProps) {
	const defaultTab: 'overview' | 'workflow' | 'finance' = 'workflow';
	const [activeTab, setActiveTab] = useState<'overview' | 'workflow' | 'finance'>(defaultTab);

	useEffect(() => {
		setActiveTab(defaultTab);
	}, [defaultTab, purchase?.id]);

	if (!purchase) return null;

	const statusUpdatedAt =
		purchase.updatedAt || purchase.approvedAt || purchase.paidAt || purchase.rejectedAt || purchase.submittedAt || purchase.createdAt;

	const highlightCards: Array<{ label: string; value: ReactNode; hint?: ReactNode }> = [
		{
			label: '当前状态',
			value: <PurchaseStatusBadge status={purchase.status} />,
			hint: statusUpdatedAt ? `更新于 ${formatDateTime(statusUpdatedAt)}` : undefined,
		},
		{
			label: '申请人',
			value: resolvePurchaser(purchase),
			hint: `工号 · ${purchase.purchaser.employeeCode ?? '—'}`,
		},
		{
			label: '当前审批人',
			value: purchase.pendingApprover?.displayName ?? purchase.approver?.displayName ?? '—',
		},
		{
			label: '采购组织',
			value: ORGANIZATION_LABELS[purchase.organizationType] ?? purchase.organizationType,
		},
		{
			label: '采购日期',
			value: formatDate(purchase.purchaseDate),
			hint: `渠道 · ${CHANNEL_LABELS[purchase.purchaseChannel]}`,
		},
		{
			label: '采购单号',
			value: purchase.purchaseNumber,
			hint: `申请人 · ${resolvePurchaser(purchase)}`,
		},
	];

	const amountRows: InfoRow[] = [
		{ label: '合同金额', value: currencyFormatter.format(purchase.totalAmount) },
		{ label: '手续费', value: currencyFormatter.format(purchase.feeAmount ?? 0) },
		{ label: '总金额（含手续费）', value: currencyFormatter.format(purchase.totalAmount + (purchase.feeAmount ?? 0)) },
	];

	const paymentRows: InfoRow[] = [
		{ label: '报销状态', value: getReimbursementStatusText(purchase.reimbursementStatus) },
		{ label: '已打款', value: currencyFormatter.format(purchase.paidAmount ?? 0) },
		{ label: '待打款', value: currencyFormatter.format(purchase.remainingAmount ?? 0) },
		{ label: '付款方式', value: PAYMENT_LABELS[purchase.paymentMethod] },
		{ label: '款项类型', value: PAYMENT_TYPE_LABELS[purchase.paymentType] },
		purchase.paymentIssueOpen
			? {
					label: '付款异常',
					value: purchase.paymentIssueReason ? `已标记 · ${purchase.paymentIssueReason}` : '已标记',
				}
			: null,
		purchase.paymentIssueAt
			? {
					label: '异常时间',
					value: formatDateTime(purchase.paymentIssueAt),
				}
			: null,
		purchase.paidAt ? { label: '打款时间', value: formatDateTime(purchase.paidAt) } : null,
		purchase.payer ? { label: '打款人', value: resolveUserName(purchase.payer) } : null,
	].filter(Boolean) as InfoRow[];

	const infoSections: InfoSectionConfig[] = [
		{
			title: '申购信息',
			rows: [
				{ label: '物品名称', value: purchase.itemName },
				{ label: '采购组织', value: ORGANIZATION_LABELS[purchase.organizationType] ?? purchase.organizationType },
				{ label: '规格 / 型号', value: purchase.specification ?? '—' },
				{ label: '数量', value: purchase.quantity },
				{ label: '申请人', value: resolvePurchaser(purchase) },
				{ label: '所属部门', value: purchase.purchaser.department ?? '—' },
				{ label: '工号', value: purchase.purchaser.employeeCode ?? '—' },
			],
		},
		{
			title: '付款与结算',
			rows: paymentRows,
		},
		{
			title: '发票与凭证',
			rows: [
				{ label: '发票类型', value: INVOICE_TYPE_LABELS[purchase.invoiceType] },
				{ label: '开票状态', value: INVOICE_STATUS_LABELS[purchase.invoiceStatus] },
				{ label: '发票号码', value: purchase.invoiceNumber ?? '—' },
				{ label: '开票日期', value: formatDate(purchase.invoiceIssueDate) },
			],
		},
		{
			title: '用途与备注',
			columns: 1,
			rows: [
				{ label: '采购用途', value: purchase.purpose },
				{ label: '备注', value: purchase.notes ?? '—' },
			],
		},
	];

	const attachmentGroups = [
		{ label: '附件', items: purchase.attachments },
		{ label: '发票', items: purchase.invoiceImages },
		{ label: '收据', items: purchase.receiptImages },
	];

	const hasAnyAttachment = attachmentGroups.some((group) => group.items.length);

	// Action Button Logic
	const actions = [
		{
			key: 'submit',
			label: '提交审批',
			visible: Boolean(permissions?.canSubmit),
			variant: 'default' as const,
			handler: () => onSubmit?.(purchase),
		},
		{
			key: 'withdraw',
			label: '撤回申请',
			visible: Boolean(permissions?.canWithdraw),
			variant: 'outline' as const,
			handler: () => onWithdraw?.(purchase),
		},
		{
			key: 'approve',
			label: '审批通过',
			visible: Boolean(permissions?.canApprove),
			variant: 'default' as const,
			handler: () => onApprove?.(purchase),
		},
		{
			key: 'transfer',
			label: '转审',
			visible: Boolean(permissions?.canTransfer),
			variant: 'outline' as const,
			handler: () => onTransfer?.(purchase),
		},
		{
			key: 'reject',
			label: '驳回申请',
			visible: Boolean(permissions?.canReject),
			variant: 'destructive' as const,
			handler: () => onReject?.(purchase),
		},
		{
			key: 'pay',
			label: '标记打款',
			visible: Boolean(permissions?.canPay),
			variant: 'default' as const,
			handler: () => onPay?.(purchase),
		},
		{
			key: 'submitReimbursement',
			label: '提交报销',
			visible: Boolean(permissions?.canSubmitReimbursement),
			variant: 'secondary' as const,
			handler: () => onSubmitReimbursement?.(purchase),
		},
	].filter((action) => action.visible);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-5xl">
				<ModalShell
					title={purchase.itemName}

					className="max-h-[90vh]"
					bodyClassName="space-y-6"
					footer={
						<DialogFooter className="gap-2 sm:justify-end">
							<Button variant="secondary" onClick={onClose}>
								关闭
							</Button>
							{actions.map((action) => (
								<Button
									key={action.key}
									variant={action.variant}
									onClick={action.handler}
									disabled={busy}
								>
									{action.label}
								</Button>
							))}
						</DialogFooter>
					}
				>
					{detailLoading ? (
						<div className="alert-box alert-info">
							正在同步最新审批状态...
						</div>
					) : null}
					{detailError ? (
						<div className="alert-box alert-danger flex flex-wrap items-center justify-between gap-3">
							<span>{detailError}</span>
							{onReloadDetail ? (
								<Button variant="outline" size="sm" onClick={onReloadDetail}>
									重试
								</Button>
							) : null}
						</div>
					) : null}
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{highlightCards.map((card) => (
							<div key={card.label} className="rounded-2xl border bg-muted/30 px-5 py-4">
								<p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
								<div className="mt-2 text-lg font-semibold text-foreground">{card.value}</div>
								{card.hint ? <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p> : null}
							</div>
						))}
					</div>
					<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'overview' | 'workflow' | 'finance')} className="space-y-4">
						<TabsList className="grid h-auto w-full grid-cols-3">
							<TabsTrigger value="overview">概览</TabsTrigger>
							<TabsTrigger value="workflow">流程</TabsTrigger>
							<TabsTrigger value="finance">资金与凭证</TabsTrigger>
						</TabsList>

						<TabsContent value="overview" className="space-y-6">
							{infoSections.map((section) => (
								<InfoSection key={section.title} {...section} />
							))}
						</TabsContent>

						<TabsContent value="workflow" className="space-y-6">
							<section className="surface-panel">
								<div className="border-b px-5 py-4">
									<p className="text-xs uppercase tracking-wide text-muted-foreground">审批流转</p>
									<p className="mt-1 text-xs text-muted-foreground">自动根据流程节点更新</p>
								</div>
								<div className="space-y-3 px-5 py-5">
									<PurchaseApprovalFlow
										purchase={purchase}
									/>
								</div>
							</section>
						</TabsContent>

						<TabsContent value="finance" className="space-y-6">
							<InfoSection title="金额概览" rows={amountRows} columns={3} />
							<InfoSection title="付款与结算" rows={paymentRows} />

							<section className="surface-panel">
								<div className="border-b px-5 py-4">
									<p className="text-xs uppercase tracking-wide text-muted-foreground">打款记录</p>
								</div>
								<div className="px-5 py-4">
									{purchase.payments.length ? (
										<div className="space-y-3">
											{purchase.payments.map((payment, index) => (
												<div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/60 px-4 py-3 text-xs">
													<div>
														<p className="text-[11px] text-muted-foreground">第 {index + 1} 笔</p>
														<p className="mt-1 text-sm font-semibold text-foreground">{currencyFormatter.format(payment.amount)}</p>
													</div>
													<div className="text-right text-muted-foreground">
														<p>{formatDateTime(payment.paidAt)}</p>
														<p>{payment.payer?.displayName ?? '未知用户'}</p>
													</div>
													{payment.note ? <p className="w-full text-muted-foreground">{payment.note}</p> : null}
												</div>
											))}
										</div>
									) : (
										<p className="text-xs text-muted-foreground">暂无打款记录</p>
									)}
								</div>
							</section>

							{hasAnyAttachment ? (
								<section className="surface-panel">
									<div className="border-b px-5 py-4">
										<p className="text-xs uppercase tracking-wide text-muted-foreground">凭证资料</p>
									</div>
									<div className="grid gap-4 px-5 py-5 md:grid-cols-3">
										{attachmentGroups.map((group) => (
											<div key={group.label} className="rounded-xl border bg-background/50 px-4 py-3">
												<p className="text-xs text-muted-foreground">{group.label}</p>
												{group.items.length ? (
													<ul className="mt-2 space-y-1 text-xs text-primary">
														{group.items.map((item, index) => (
															<li key={`${group.label}-${index}`} className="truncate">
																<a href={item} target="_blank" rel="noreferrer" className="hover:underline">
																	{item}
																</a>
															</li>
														))}
													</ul>
												) : (
													<p className="mt-2 text-xs text-muted-foreground">暂无</p>
												)}
											</div>
										))}
									</div>
								</section>
							) : null}
						</TabsContent>
					</Tabs>
				</ModalShell>
			</DialogContent>
		</Dialog>
	);
}
