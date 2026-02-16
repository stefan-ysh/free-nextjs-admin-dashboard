'use client';

import PurchaseStatusBadge from './PurchaseStatusBadge';
import type { PurchaseRowPermissions } from './PurchaseTable';
import type { PurchaseDetail, PurchaseRecord, ReimbursementLog, ReimbursementAction } from '@/types/purchase';
import { getPurchaseStatusText } from '@/types/purchase';
import { cn } from '@/lib/utils';
import { isReimbursementV2Enabled } from '@/lib/features/gates';

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
			? `申请人 ${purchase.purchaser.displayName || purchase.purchaser.id}`
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
			? `审批通过 (操作人: ${purchase.approvedBy ?? '管理员'})`
			: isRejected
				? `已驳回: ${purchase.rejectionReason ?? '无理由'}`
				: '等待管理员审批',
		timestamp: purchase.approvedAt ?? purchase.rejectedAt ?? undefined,
		status: isApproved ? 'done' : isRejected ? 'done' : hasSubmitted ? 'active' : 'pending',
		tone: isApproved ? 'success' : isRejected ? 'danger' : 'default',
		note: isRejected ? purchase.rejectionReason ?? undefined : undefined,
	});

	if (isRejected) return steps;

	// v2: purchase flow ends after approval/payment stage.
	if (reimbursementV2Enabled) {
		const isPaid = purchase.status === 'paid';
		steps.push({
			key: 'payment',
			title: '财务打款',
			description: isPaid
				? `已打款 (操作人: ${purchase.paidBy ?? '财务'})`
				: '审批通过后由财务完成打款（如需报销请前往报销中心）',
			timestamp: purchase.paidAt ?? undefined,
			status: isPaid ? 'done' : isApproved ? 'active' : 'pending',
			tone: isPaid ? 'success' : 'default',
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
			? `已打款 (操作人: ${purchase.paidBy ?? '财务'})`
			: '等待财务打款',
		timestamp: purchase.paidAt ?? undefined,
		status: isPaid ? 'done' : isReimbursed ? 'active' : 'pending',
		tone: isPaid ? 'success' : 'default',
	});

	return steps;
}

function resolveOperatorName(purchase: PurchaseDetail, operatorId: string, operatorName?: string | null): string {
    if (operatorName) return operatorName;
	if (purchase.purchaser.id === operatorId) return purchase.purchaser.displayName || operatorId;
	if (purchase.approver?.id === operatorId) return purchase.approver.displayName;
	if (purchase.rejecter?.id === operatorId) return purchase.rejecter.displayName;
	if (purchase.payer?.id === operatorId) return purchase.payer.displayName;
	return operatorId;
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

	const actions: Array<{
		key: keyof typeof ACTION_STYLES;
		label: string;
		visible: boolean;
		handler?: (purchase: PurchaseRecord) => void;
	}> = [
		{ key: 'submit', label: '提交审批', visible: Boolean(permissions?.canSubmit), handler: onSubmit },
		{ key: 'withdraw', label: '撤回申请', visible: Boolean(permissions?.canWithdraw), handler: onWithdraw },
		{ key: 'approve', label: '审批通过', visible: Boolean(permissions?.canApprove), handler: onApprove },
		{ key: 'transfer', label: '转审', visible: Boolean(permissions?.canTransfer), handler: onTransfer },
		{ key: 'reject', label: '驳回申请', visible: Boolean(permissions?.canReject), handler: onReject },
		{
			key: 'submitReimbursement',
			label: '提交报销',
			visible: !reimbursementV2Enabled && Boolean(permissions?.canSubmitReimbursement),
			handler: onSubmitReimbursement,
		},
		{ key: 'pay', label: '标记打款', visible: Boolean(permissions?.canPay), handler: onPay },
	];

	const visibleActions = actions.filter((action) => action.visible);
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
		<div className="space-y-4">
			<div className="panel-frame p-4">
				<div className="flex items-center justify-between gap-4">
					<div>
						<p className="text-xs uppercase tracking-wide text-muted-foreground">当前状态</p>
						<div className="mt-2">
							<PurchaseStatusBadge status={purchase.status} />
						</div>
					</div>
					<div className="text-right text-xs text-muted-foreground">
						<div>最近更新</div>
						<div className="font-mono text-sm text-foreground">{formatDateTime(purchase.updatedAt) ?? '—'}</div>
					</div>
				</div>
			</div>

			<div className="panel-frame p-4">
				<div className="mb-4 flex items-center justify-between gap-2">
					<div>
						<p className="text-xs uppercase tracking-wide text-muted-foreground">审批流与日志</p>
						<h4 className="text-sm font-semibold text-foreground">流程节点与操作记录</h4>
					</div>
					<span className="text-xs text-muted-foreground">按节点聚合展示</span>
				</div>
				<ol className="relative space-y-6 border-l border-border pl-6">
					{timeline.map((step) => (
						<li key={step.key} className="relative pl-2">
							<span className={`absolute -left-3 top-6 h-3 w-3 rounded-full border-2 ${STATUS_DOT_CLASS[step.status]}`}></span>
							<div
								className={cn(
									'flex flex-col gap-2 rounded-2xl border border-transparent bg-card/60 p-3 transition',
									step.status === 'active' && 'border-chart-2/40 bg-chart-2/10 shadow-sm',
									step.status === 'done' && 'bg-chart-5/10',
									step.status === 'pending' && 'bg-muted/60'
								)}
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<p className={`text-sm font-semibold ${TONE_TEXT_CLASS[step.tone]}`}>{step.title}</p>
									<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
										<span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STEP_STATUS_BADGE[step.status])}>{STEP_STATUS_LABEL[step.status]}</span>
										{formatDateTime(step.timestamp) && (
											<time>{formatDateTime(step.timestamp)}</time>
										)}
									</div>
								</div>
								<p className="text-xs text-muted-foreground">{step.description}</p>
								{step.note && (
									<p className="text-xs text-destructive">{step.note}</p>
								)}
								{(stepLogsMap.get(step.key)?.length ?? 0) > 0 ? (
									<div className="mt-2 rounded-xl border border-dashed border-border/80 bg-background/40 p-2">
										<p className="mb-2 text-[11px] text-muted-foreground">
											相关记录 {stepLogsMap.get(step.key)?.length}
										</p>
										<ol className="space-y-2">
											{(stepLogsMap.get(step.key) ?? []).map((log) => renderLogEntry(purchase, log))}
										</ol>
									</div>
								) : null}
							</div>
						</li>
					))}
				</ol>
				{otherLogs.length > 0 ? (
					<div className="mt-4 rounded-xl border border-dashed border-border/80 bg-background/40 p-3">
						<p className="mb-2 text-xs text-muted-foreground">其他操作记录</p>
						<ol className="space-y-2">
							{otherLogs.map((log) => renderLogEntry(purchase, log))}
						</ol>
					</div>
				) : null}
			</div>

			<div className="panel-frame p-4">
				<div className="flex items-center justify-between gap-2">
					<div>
						<p className="text-xs uppercase tracking-wide text-muted-foreground">可执行动作</p>
						<h4 className="text-sm font-semibold text-foreground">审批操作区</h4>
					</div>
					<span className="text-xs text-muted-foreground">根据权限自动展示</span>
				</div>
				<div className="mt-4 flex flex-wrap gap-2">
					{visibleActions.length === 0 && (
						<p className="text-xs text-muted-foreground">当前状态暂无可执行操作。</p>
					)}
					{visibleActions.map((action) => (
						<button
							key={action.key}
							type="button"
							onClick={() => action.handler?.(purchase)}
							disabled={busy}
							className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${ACTION_STYLES[action.key]} ${busy ? 'opacity-60' : ''}`.trim()}
						>
							{action.label}
						</button>
					))}
				</div>
			</div>

		</div>
	);
}
