'use client';

import PurchaseStatusBadge from './PurchaseStatusBadge';
import type { PurchaseRowPermissions } from './PurchaseTable';
import type { PurchaseDetail, PurchaseRecord, ReimbursementLog, ReimbursementAction } from '@/types/purchase';
import { getPurchaseStatusText } from '@/types/purchase';
import { cn } from '@/lib/utils';
import { isReimbursementV2Enabled } from '@/lib/features/gates';
import { Check, Clock, FileText } from 'lucide-react';

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
});



type TimelineStatus = 'done' | 'active' | 'pending';
type TimelineTone = 'default' | 'success' | 'danger' | 'warning';

type TimelineStep = {
	key: string;
	title: string;
	description: string;
	timestamp?: string;
	status: TimelineStatus;
	tone: TimelineTone;
	note?: string;
};

type PurchaseApprovalFlowProps = {
	purchase: PurchaseDetail;
	permissions?: PurchaseRowPermissions;
	onSubmit?: (purchase: PurchaseRecord) => void;
	onWithdraw?: (purchase: PurchaseRecord) => void;
	onApprove?: (purchase: PurchaseRecord) => void;
	onReject?: (purchase: PurchaseRecord) => void;
	onPay?: (purchase: PurchaseRecord) => void;
	onSubmitReimbursement?: (purchase: PurchaseRecord) => void;
	onTransfer?: (purchase: PurchaseRecord) => void;
	busy?: boolean;
};

const STATUS_DOT_CLASS: Record<TimelineStatus, string> = {
	done: 'border-chart-5 bg-chart-5',
	active: 'border-chart-2 bg-chart-2',
	pending: 'border-border bg-muted',
};

const STEP_STATUS_LABEL: Record<TimelineStatus, string> = {
	done: '已完成',
	active: '进行中',
	pending: '待开始',
};

const STEP_STATUS_BADGE: Record<TimelineStatus, string> = {
	done: 'bg-chart-5/15 text-chart-5',
	active: 'bg-chart-2/15 text-chart-2',
	pending: 'bg-muted text-muted-foreground',
};

const TONE_TEXT_CLASS: Record<TimelineTone, string> = {
	default: 'text-foreground',
	success: 'text-chart-5',
	danger: 'text-destructive',
	warning: 'text-chart-3',
};

const ACTION_STYLES = {
	submit: 'border-chart-5/50 text-chart-5 hover:bg-chart-5/10',
	withdraw: 'border-chart-3/50 text-chart-3 hover:bg-chart-3/10',
	approve: 'border-chart-2/50 text-chart-2 hover:bg-chart-2/10',
	transfer: 'border-foreground/30 text-foreground hover:bg-muted',
	reject: 'border-destructive/50 text-destructive hover:bg-destructive/10',
	pay: 'border-primary/50 text-primary hover:bg-primary/10',
	submitReimbursement:
		'border-secondary/70 text-secondary-foreground hover:bg-secondary/40',
};

const ACTION_LABELS: Record<ReimbursementAction, string> = {
	submit: '提交审批',
	approve: '审批通过',
	reject: '驳回申请',
	pay: '标记打款',
	issue: '付款异常',
	resolve: '解除异常',
	cancel: '取消记录',
	withdraw: '撤回申请',
	transfer: '转交审批',
};

function formatDateTime(value?: string | null) {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return dateTimeFormatter.format(date);
}

// Hardcoded 5-step flow
function buildTimeline(purchase: PurchaseDetail, reimbursementV2Enabled: boolean): TimelineStep[] {
	const steps: TimelineStep[] = [];

	// Step 1: Submit
	const hasSubmitted = Boolean(purchase.submittedAt);
	const isCancelled = purchase.status === 'cancelled';
	steps.push({
		key: 'submit',
		title: '提交申请',
		description: hasSubmitted 
			? `申请人 ${purchase.purchaser.displayName || '未知用户'}`
			: '草稿状态',
		timestamp: purchase.submittedAt ?? purchase.createdAt,
		status: hasSubmitted ? 'done' : 'active',
		tone: 'default',
	});

	if (isCancelled) {
		steps.push({
			key: 'end',
			title: '已取消',
			description: '流程已终止',
			timestamp: purchase.updatedAt,
			status: 'done',
			tone: 'warning',
		});
		return steps;
	}

	// Step 2: Approval (Manager/Admin)
	const isApproved = purchase.approvedAt || purchase.status === 'approved' || purchase.status === 'paid';
	const isRejected = purchase.status === 'rejected';
	steps.push({
		key: 'approval',
		title: '管理审批',
		description: isApproved
			? `审批通过 (操作人: ${purchase.approver?.displayName || purchase.approvedByName || '管理员'})`
			: isRejected
				? `已驳回: ${purchase.rejectionReason ?? '无理由'}`
				: '等待管理员审批',
		timestamp: purchase.approvedAt ?? purchase.rejectedAt ?? undefined,
		status: isApproved ? 'done' : isRejected ? 'done' : hasSubmitted ? 'active' : 'pending',
		tone: isApproved ? 'success' : isRejected ? 'danger' : 'default',
		note: isRejected ? purchase.rejectionReason ?? undefined : undefined,
	});

	if (isRejected) return steps;

	// v2: purchase flow = submit -> approval -> inbound.
	if (reimbursementV2Enabled) {
		const isInboundDone = purchase.status === 'approved' || purchase.status === 'paid';
		steps.push({
			key: 'inbound',
			title: '到货入库',
			description: isInboundDone
				? '已完成入库'
				: '审批通过后请采购申请人完成到货入库',
			timestamp: purchase.updatedAt ?? undefined,
			status: isInboundDone ? 'done' : isApproved ? 'active' : 'pending',
			tone: isInboundDone ? 'success' : 'default',
		});
		return steps;
	}

	// Step 3: Reimbursement (Legacy)
	const hasReimbursement = purchase.reimbursementStatus !== 'none' && purchase.reimbursementStatus !== 'invoice_pending';
	steps.push({
		key: 'reimbursement_submit',
		title: '提交报销',
		description: hasReimbursement
			? '已提交发票'
			: '审批通过后需补充发票信息',
		timestamp: purchase.reimbursementSubmittedAt ?? undefined,
		status: hasReimbursement ? 'done' : isApproved ? 'active' : 'pending',
		tone: 'default',
	});

	// Step 4: Finance Audit
	const isReimbursed = purchase.reimbursementStatus === 'reimbursed' || purchase.status === 'paid';
	const isReimbRejected = purchase.reimbursementStatus === 'reimbursement_rejected';
	steps.push({
		key: 'finance_audit',
		title: '财务审核',
		description: isReimbursed
			? '审核通过'
			: isReimbRejected
				? `审核驳回: ${purchase.reimbursementRejectedReason ?? ''}`
				: hasReimbursement ? '等待财务审核' : '待提交报销',
		timestamp: undefined, // No specific timestamp for audit start/end unless we track it differently
		status: isReimbursed ? 'done' : isReimbRejected ? 'active' : hasReimbursement ? 'active' : 'pending',
		tone: isReimbursed ? 'success' : isReimbRejected ? 'danger' : 'default',
	});

	// Step 5: Payment
	const isPaid = purchase.status === 'paid';
	steps.push({
		key: 'payment',
		title: '财务打款',
		description: isPaid
			? `已打款 (操作人: ${purchase.payer?.displayName || purchase.paidByName || '财务'})`
			: '等待财务打款',
		timestamp: purchase.paidAt ?? undefined,
		status: isPaid ? 'done' : isReimbursed ? 'active' : 'pending',
		tone: isPaid ? 'success' : 'default',
	});

	return steps;
}

function resolveOperatorName(purchase: PurchaseDetail, operatorId: string, operatorName?: string | null): string {
    if (operatorName) return operatorName;
	if (purchase.purchaser.id === operatorId) return purchase.purchaser.displayName || '未知用户';
	if (purchase.approver?.id === operatorId) return purchase.approver.displayName;
	if (purchase.rejecter?.id === operatorId) return purchase.rejecter.displayName;
	if (purchase.payer?.id === operatorId) return purchase.payer.displayName;
	return '未知用户';
}

function renderLogEntry(purchase: PurchaseDetail, log: ReimbursementLog) {
	const statusChange = `${getPurchaseStatusText(log.fromStatus)} → ${getPurchaseStatusText(log.toStatus)}`;
	return (
		<li key={log.id} className="rounded-xl border border-border p-3 text-xs">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="font-semibold text-foreground">{ACTION_LABELS[log.action] ?? log.action}</p>
				<time className="font-mono text-muted-foreground">{formatDateTime(log.createdAt) ?? '—'}</time>
			</div>
			<p className="mt-1 text-muted-foreground">状态 {statusChange}</p>
			<p className="text-muted-foreground">操作人 {resolveOperatorName(purchase, log.operatorId, log.operatorName)}</p>
			{log.comment && <p className="mt-1 text-destructive">备注：{log.comment}</p>}
		</li>
	);
}

function classifyLogToStep(log: ReimbursementLog): TimelineStep['key'] | 'other' {
	if (log.action === 'submit') {
		if (log.fromStatus === 'draft' && log.toStatus === 'draft') return 'submit';
		if (log.toStatus === 'pending_approval' || log.fromStatus === 'draft') return 'submit';
		// If submitted while approved, it's likely reimbursement submission
		if (log.fromStatus === 'approved' || log.fromStatus === 'paid') return 'reimbursement_submit';
		return 'submit';
	}
	if (log.action === 'approve' || log.action === 'reject' || log.action === 'transfer') return 'approval';
	// if (log.action === 'submitReimbursement') return 'reimbursement_submit'; // Invalid action
	if (log.action === 'resolve' || log.action === 'issue') return 'finance_audit';
	if (log.action === 'pay') return 'payment';

	return 'other';
}

export default function PurchaseApprovalFlow({
	purchase,
	permissions,
	onSubmit,
	onWithdraw,
	onApprove,
	onReject,
	onPay,
	onSubmitReimbursement,
	onTransfer,
	busy,
}: PurchaseApprovalFlowProps) {
	const reimbursementV2Enabled = isReimbursementV2Enabled();
	const timeline = buildTimeline(purchase, reimbursementV2Enabled);


	const sortedLogs = [...purchase.logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	const stepLogsMap = new Map<string, ReimbursementLog[]>();
	const otherLogs: ReimbursementLog[] = [];
	for (const log of sortedLogs) {
		const stepKey = classifyLogToStep(log);
		if (stepKey === 'other') {
			otherLogs.push(log);
			continue;
		}
		const group = stepLogsMap.get(stepKey) ?? [];
		group.push(log);
		stepLogsMap.set(stepKey, group);
	}

	return (

		<div className="space-y-6">
			{/* Header Status Card */}
			<div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
						<FileText className="h-5 w-5 text-primary" />
					</div>
					<div>
						<p className="text-xs font-medium text-muted-foreground">当前状态</p>
						<div className="mt-1">
							<PurchaseStatusBadge status={purchase.status} />
						</div>
					</div>
				</div>
				<div className="text-right">
					<p className="text-xs text-muted-foreground">最近更新</p>
					<p className="font-mono text-sm font-medium text-foreground">
						{formatDateTime(purchase.updatedAt) ?? '—'}
					</p>
				</div>
			</div>

			{/* Timeline Flow */}
			<div className="relative pl-4">
				{/* Virtual Line */}
				<div className="absolute bottom-0 left-[27px] top-4 w-px bg-border" />

				<div className="space-y-8">
					{timeline.map((step, index) => {
						const isLast = index === timeline.length - 1;
						const isActive = step.status === 'active';
						const isDone = step.status === 'done';
						const isPending = step.status === 'pending';

						return (
							<div key={step.key} className="relative flex gap-4">
								{/* Timeline Node */}
								<div
									className={cn(
										'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-background ring-4 ring-background transition-colors',
										isActive
											? 'border-primary text-primary'
											: isDone
												? 'border-primary bg-primary text-primary-foreground'
												: 'border-muted-foreground/30 text-muted-foreground/30'
									)}
								>
									{isDone ? (
										<Check className="h-3 w-3" />
									) : isActive ? (
										<div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
									) : (
										<div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
									)}
								</div>

								{/* Content Card */}
								<div className="flex-1 pt-0.5">
									<div className="flex items-center justify-between gap-4">
										<h4
											className={cn(
												'text-sm font-semibold',
												isActive ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground'
											)}
										>
											{step.title}
										</h4>
										<span className="text-xs text-muted-foreground">
											{formatDateTime(step.timestamp)}
										</span>
									</div>
									
									<p className="mt-1 text-sm text-foreground/80">{step.description}</p>
									
									{step.note && (
										<div className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
											{step.note}
										</div>
									)}

									{/* Logs Section */}
									{(stepLogsMap.get(step.key)?.length ?? 0) > 0 && (
										<div className="mt-3 space-y-2">
											{stepLogsMap.get(step.key)?.map((log) => (
												<div
													key={log.id}
													className="relative rounded-lg border bg-muted/30 px-3 py-2 text-xs transition hover:bg-muted/50"
												>
													<div className="flex items-center justify-between gap-2">
														<span className="font-semibold text-foreground">
															{ACTION_LABELS[log.action] ?? log.action}
														</span>
														<time className="font-mono text-muted-foreground">
															{formatDateTime(log.createdAt)}
														</time>
													</div>
													<div className="mt-1 flex flex-wrap items-center gap-x-2 text-muted-foreground">
														<span>
															{resolveOperatorName(purchase, log.operatorId, log.operatorName)}
														</span>
														{log.comment && (
															<>
																<span>·</span>
																<span className="text-foreground">{log.comment}</span>
															</>
														)}
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Other Logs */}
			{otherLogs.length > 0 && (
				<div className="mt-8 border-t pt-6">
					<h4 className="mb-4 text-sm font-medium text-muted-foreground">其他记录</h4>
					<div className="space-y-2">
						{otherLogs.map((log) => (
							<div
								key={log.id}
								className="flex items-center justify-between rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs"
							>
								<div className="flex items-center gap-2">
									<span className="font-medium">{ACTION_LABELS[log.action] ?? log.action}</span>
									<span className="text-muted-foreground">
										{resolveOperatorName(purchase, log.operatorId, log.operatorName)}
									</span>
								</div>
								<time className="font-mono text-muted-foreground">
									{formatDateTime(log.createdAt)}
								</time>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
