'use client';

import type { ReactNode } from 'react';

import ModalShell from '@/components/common/ModalShell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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
	return user?.displayName ?? user?.id ?? '—';
}

function resolvePurchaser(purchase: PurchaseDetail): string {
	return purchase.purchaser.displayName || purchase.purchaser.id;
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
		<section className="rounded-2xl border bg-card text-card-foreground shadow-sm">
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

type FlowTimelineItem = {
	key: string;
	title: string;
	description: string;
	timestamp: string | null;
	meta?: string;
};

function FlowTimeline({ items }: { items: FlowTimelineItem[] }) {
	const firstPendingIndex = items.findIndex((item) => !item.timestamp);
	return (
		<ol className="space-y-4 px-5 py-5">
			{items.map((item, index) => {
				const status: 'done' | 'current' | 'upcoming' = item.timestamp
					? 'done'
					: firstPendingIndex === -1 || index < firstPendingIndex
						? 'done'
						: index === firstPendingIndex
							? 'current'
							: 'upcoming';
				const dotClass = cn(
					'h-3 w-3 rounded-full border-2',
					status === 'done' && 'border-emerald-500 bg-emerald-500',
					status === 'current' && 'border-sky-500 bg-sky-500 animate-pulse',
					status === 'upcoming' && 'border-border bg-background'
				);
				const lineClass = cn(
					'w-px flex-1',
					status === 'done' ? 'bg-emerald-200 dark:bg-emerald-900/50' : 'bg-border'
				);
				return (
					<li key={item.key} className="flex gap-4">
						<div className="flex flex-col items-center">
							<span className={dotClass} />
							{index < items.length - 1 ? <span className={lineClass} /> : null}
						</div>
						<div className="flex-1 rounded-2xl border bg-background/70 px-4 py-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<p className="text-sm font-semibold text-foreground">{item.title}</p>
								<span className="text-xs text-muted-foreground">{item.timestamp ? formatDateTime(item.timestamp) : '待更新'}</span>
							</div>
							<p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
							{item.meta ? <p className="mt-1 text-xs text-muted-foreground/80">{item.meta}</p> : null}
						</div>
					</li>
				);
			})}
		</ol>
	);
}

function buildFlowTimeline(purchase: PurchaseDetail): FlowTimelineItem[] {
	const steps: FlowTimelineItem[] = [
		{
			key: 'created',
			title: '创建申请',
			description: `${resolvePurchaser(purchase)} 发起采购请求`,
			timestamp: purchase.createdAt ?? purchase.submittedAt ?? null,
			meta: `单号 ${purchase.purchaseNumber}`,
		},
		{
			key: 'submitted',
			title: '提交审批',
			description: purchase.submittedAt ? '已进入审批流' : '等待提交至审批流',
			timestamp: purchase.submittedAt,
		},
	];

	if (purchase.rejectedAt) {
		steps.push({
			key: 'rejected',
			title: '审批驳回',
			description: purchase.rejectionReason ? `原因：${purchase.rejectionReason}` : '审批人退回该申请',
			meta: `驳回人：${resolveUserName(purchase.rejecter)}`,
			timestamp: purchase.rejectedAt,
		});
	} else {
		steps.push({
			key: 'approved',
			title: '审批通过',
			description: purchase.approvedAt ? `由 ${resolveUserName(purchase.approver)} 批准` : '等待审批人处理',
			meta: purchase.approvedAt ? undefined : '审批节点未完成',
			timestamp: purchase.approvedAt,
		});
		steps.push({
			key: 'paid',
			title: '打款完成',
			description: purchase.paidAt ? `财务 ${resolveUserName(purchase.payer)} 已完成打款` : '等待财务确认打款',
			meta: purchase.transactionNo ? `流水号：${purchase.transactionNo}` : undefined,
			timestamp: purchase.paidAt,
		});
	}

	return steps;
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
	if (!purchase) return null;

	const statusUpdatedAt =
		purchase.updatedAt || purchase.approvedAt || purchase.paidAt || purchase.rejectedAt || purchase.submittedAt || purchase.createdAt;
	const timelineItems = buildFlowTimeline(purchase);

	const highlightCards: Array<{ label: string; value: ReactNode; hint?: ReactNode }> = [
		{
			label: '当前状态',
			value: <PurchaseStatusBadge status={purchase.status} />,
			hint: statusUpdatedAt ? `更新于 ${formatDateTime(statusUpdatedAt)}` : undefined,
		},
		{
			label: '采购日期',
			value: formatDate(purchase.purchaseDate),
			hint: `渠道 · ${CHANNEL_LABELS[purchase.purchaseChannel]}`,
		},
		{
			label: '采购单号',
			value: purchase.purchaseNumber,
			hint: purchase.project ? `关联项目 · ${purchase.project.projectName}` : `申请人 · ${resolvePurchaser(purchase)}`,
		},
	];

	const amountRows: InfoRow[] = [
		{ label: '合同金额', value: currencyFormatter.format(purchase.totalAmount) },
		{ label: '手续费', value: currencyFormatter.format(purchase.feeAmount ?? 0) },
		{ label: '总金额（含手续费）', value: currencyFormatter.format(purchase.totalAmount + (purchase.feeAmount ?? 0)) },
	];

	const infoSections: InfoSectionConfig[] = [
		{
			title: '申购信息',
			rows: [
				{ label: '物品名称', value: purchase.itemName },
				{ label: '规格 / 型号', value: purchase.specification ?? '—' },
				{ label: '数量', value: purchase.quantity },
				{ label: '申请人', value: resolvePurchaser(purchase) },
				{ label: '所属部门', value: purchase.purchaser.department ?? '—' },
				{ label: '工号', value: purchase.purchaser.employeeCode ?? '—' },
				{
					label: '关联项目',
					value: purchase.project ? `${purchase.project.projectName}（${purchase.project.projectCode}）` : '—',
				},
			],
		},
		{
			title: '付款与结算',
			rows: [
				{ label: '付款方式', value: PAYMENT_LABELS[purchase.paymentMethod] },
				{ label: '款项类型', value: PAYMENT_TYPE_LABELS[purchase.paymentType] },
				{ label: '支付通道', value: purchase.paymentChannel ?? '—' },
				{ label: '代付人', value: purchase.payerName ?? '—' },
				{ label: '支付流水号', value: purchase.transactionNo ?? '—' },
				{ label: '打款时间', value: formatDateTime(purchase.paidAt) },
				{ label: '打款人', value: resolveUserName(purchase.payer) },
			],
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

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-5xl">
				<ModalShell
					title={purchase.itemName}
					description={`采购编号 ${purchase.purchaseNumber} · 最近更新 ${formatDateTime(statusUpdatedAt)}`}
					headerActions={
						<Button variant="outline" size="sm" onClick={onClose}>
							关闭
						</Button>
					}
					className="max-h-[90vh]"
					bodyClassName="space-y-6"
					footer={
						<DialogFooter className="justify-end">
							<Button variant="secondary" onClick={onClose}>
								关闭
							</Button>
						</DialogFooter>
					}
				>
					{detailLoading ? (
						<div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
							正在同步最新审批状态...
						</div>
					) : null}
					{detailError ? (
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
							<span>{detailError}</span>
							{onReloadDetail ? (
								<Button variant="outline" size="sm" onClick={onReloadDetail}>
									重试
								</Button>
							) : null}
						</div>
					) : null}
					<div className="grid gap-4 md:grid-cols-3">
						{highlightCards.map((card) => (
							<div key={card.label} className="rounded-2xl border bg-muted/30 px-5 py-4">
								<p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
								<div className="mt-2 text-lg font-semibold text-foreground">{card.value}</div>
								{card.hint ? <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p> : null}
							</div>
						))}
					</div>
					<div className="grid gap-6 lg:grid-cols-12">
						<div className="space-y-6 lg:col-span-7">
							<InfoSection title="金额概览" rows={amountRows} columns={3} />
							{infoSections.map((section) => (
								<InfoSection key={section.title} {...section} />
							))}
							{timelineItems.length ? (
								<section className="rounded-2xl border bg-card text-card-foreground shadow-sm">
									<div className="border-b px-5 py-4">
										<p className="text-xs uppercase tracking-wide text-muted-foreground">流程节点</p>
										<p className="mt-1 text-xs text-muted-foreground">以时间轴展示审批与打款节点</p>
									</div>
									<FlowTimeline items={timelineItems} />
								</section>
							) : null}
							{hasAnyAttachment ? (
								<section className="rounded-2xl border bg-card text-card-foreground shadow-sm">
									<div className="border-b px-5 py-4">
										<p className="text-xs uppercase tracking-wide text-muted-foreground">凭证资料</p>
									</div>
									<div className="grid gap-4 px-5 py-5 md:grid-cols-3">
										{attachmentGroups.map((group) => (
											<div key={group.label} className="rounded-xl border bg-background/50 px-4 py-3">
												<p className="text-xs text-muted-foreground">{group.label}</p>
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
													<p className="mt-2 text-xs text-muted-foreground">暂无</p>
												)}
											</div>
										))}
									</div>
								</section>
							) : null}
						</div>
						<div className="space-y-6 lg:col-span-5">
							<section className="rounded-2xl border bg-card text-card-foreground shadow-sm">
								<div className="border-b px-5 py-4">
									<p className="text-xs uppercase tracking-wide text-muted-foreground">审批流转</p>
									<p className="mt-1 text-xs text-muted-foreground">自动根据流程节点更新</p>
								</div>
								<div className="px-5 py-5">
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
							</section>
						</div>
					</div>
				</ModalShell>
			</DialogContent>
		</Dialog>
	);
}
