'use client';

import PurchaseStatusBadge from './PurchaseStatusBadge';
import type { PurchaseRowPermissions } from './PurchaseTable';
import type { PurchaseDetail, PurchaseRecord, ReimbursementLog, ReimbursementAction } from '@/types/purchase';
import { getPurchaseStatusText } from '@/types/purchase';
import { cn } from '@/lib/utils';

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
});

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
	style: 'currency',
	currency: 'CNY',
	minimumFractionDigits: 2,
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
	done: 'border-emerald-500 bg-emerald-500',
	active: 'border-blue-500 bg-blue-500',
	pending: 'border-gray-300 bg-gray-100 dark:bg-gray-800',
};

const STEP_STATUS_LABEL: Record<TimelineStatus, string> = {
	done: '已完成',
	active: '进行中',
	pending: '待开始',
};

const STEP_STATUS_BADGE: Record<TimelineStatus, string> = {
	done: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200',
	active: 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200',
	pending: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300',
};

const TONE_TEXT_CLASS: Record<TimelineTone, string> = {
	default: 'text-gray-600 dark:text-gray-300',
	success: 'text-emerald-600 dark:text-emerald-300',
	danger: 'text-rose-600 dark:text-rose-300',
	warning: 'text-amber-600 dark:text-amber-300',
};

const ACTION_STYLES = {
	submit: 'border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-200',
	withdraw: 'border-amber-500 text-amber-600 hover:bg-amber-50 dark:border-amber-400 dark:text-amber-200',
	approve: 'border-indigo-500 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-200',
	transfer: 'border-slate-500 text-slate-600 hover:bg-slate-50 dark:border-slate-400 dark:text-slate-200',
	reject: 'border-rose-500 text-rose-600 hover:bg-rose-50 dark:border-rose-400 dark:text-rose-200',
	pay: 'border-purple-500 text-purple-600 hover:bg-purple-50 dark:border-purple-400 dark:text-purple-200',
	submitReimbursement:
		'border-cyan-500 text-cyan-600 hover:bg-cyan-50 dark:border-cyan-400 dark:text-cyan-200',
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

function buildTimeline(purchase: PurchaseDetail): TimelineStep[] {
	const steps: TimelineStep[] = [];
	steps.push({
		key: 'draft',
		title: '创建草稿',
		description: `申请人 ${purchase.purchaser.displayName || purchase.purchaser.id}`,
		timestamp: purchase.createdAt,
		status: 'done',
		tone: 'default',
	});

	const hasSubmitted = Boolean(purchase.submittedAt);
	const isPendingApproval = purchase.status === 'pending_approval';
	const isDraftish = purchase.status === 'draft' || purchase.status === 'rejected';
	const isCancelled = purchase.status === 'cancelled';

	steps.push({
		key: 'submit',
		title: hasSubmitted ? '已提交审批' : '等待提交',
		description: hasSubmitted ? '申请单已进入审批流' : '草稿状态下可编辑后提交审批',
		timestamp: purchase.submittedAt ?? undefined,
		status: hasSubmitted ? (isPendingApproval ? 'active' : 'done') : isDraftish ? 'active' : 'pending',
		tone: hasSubmitted ? 'default' : 'warning',
	});

	if (isCancelled) {
		steps.push({
			key: 'withdraw',
			title: '申请已撤回',
			description: '已从审批流撤出，可修改内容后重新提交',
			timestamp: purchase.updatedAt,
			status: 'done',
			tone: 'warning',
		});
		return steps;
	}

		const approvalStep: TimelineStep = {
			key: 'approval',
			title: purchase.status === 'rejected' ? '审批驳回' : '审批环节',
			description: '等待审批人处理',
			timestamp: purchase.approvedAt ?? purchase.rejectedAt ?? undefined,
			status: 'pending',
			tone: 'default',
			note: purchase.rejectionReason ?? undefined,
		};

	if (purchase.rejectedAt) {
		approvalStep.status = 'done';
		approvalStep.tone = 'danger';
		approvalStep.description = purchase.rejectionReason ? `驳回原因：${purchase.rejectionReason}` : '审批人已驳回';
	} else if (purchase.approvedAt) {
		approvalStep.status = purchase.status === 'approved' || purchase.status === 'paid' ? 'done' : 'active';
		approvalStep.tone = 'success';
		approvalStep.description = `审批人 ${purchase.approver?.displayName ?? purchase.approvedBy ?? '—'}`;
		} else if (isPendingApproval) {
			approvalStep.status = 'active';
			approvalStep.description = purchase.pendingApprover?.displayName
				? `等待 ${purchase.pendingApprover.displayName} 审批`
				: '正在等待审批人确认';
		} else if (!hasSubmitted) {
			approvalStep.status = 'pending';
			approvalStep.description = '提交后进入审批流程';
		}

	steps.push(approvalStep);

	if (purchase.status === 'rejected') {
		return steps;
	}

	const reimbursementStep: TimelineStep = {
		key: 'reimbursement',
		title: '报销申请',
		description: '审批通过后，申请人上传发票并提交报销',
		timestamp: purchase.reimbursementSubmittedAt ?? undefined,
		status: 'pending',
		tone: 'default',
	};

	if (purchase.reimbursementStatus === 'invoice_pending') {
		reimbursementStep.status = 'active';
		reimbursementStep.description = '待申请人补充发票并提交报销';
	} else if (purchase.reimbursementStatus === 'reimbursement_pending') {
		reimbursementStep.status = 'done';
		reimbursementStep.tone = 'success';
		reimbursementStep.description = '已提交报销，等待财务确认';
	} else if (purchase.reimbursementStatus === 'reimbursement_rejected') {
		reimbursementStep.status = 'active';
		reimbursementStep.tone = 'danger';
		reimbursementStep.description = purchase.reimbursementRejectedReason
			? `报销被驳回：${purchase.reimbursementRejectedReason}`
			: '报销被驳回，请补充后再次提交';
	} else if (purchase.reimbursementStatus === 'reimbursed') {
		reimbursementStep.status = 'done';
		reimbursementStep.tone = 'success';
		reimbursementStep.description = '报销流程完成';
	}
	steps.push(reimbursementStep);

	const paymentStep: TimelineStep = {
		key: 'payment',
		title: purchase.status === 'paid' ? '打款完成' : '等待打款',
		description:
			purchase.status === 'paid'
				? `经办人 ${purchase.payer?.displayName ?? purchase.paidBy ?? '—'}`
				: purchase.paidAmount > 0
					? `已打款 ${currencyFormatter.format(purchase.paidAmount)} / ${currencyFormatter.format(purchase.dueAmount)}`
					: purchase.reimbursementStatus === 'reimbursement_pending'
						? '财务待打款'
						: '提交报销后由财务打款',
		timestamp: purchase.payments.length ? purchase.payments[purchase.payments.length - 1].paidAt : purchase.paidAt ?? undefined,
		status:
			purchase.status === 'paid'
				? 'done'
				: purchase.reimbursementStatus === 'reimbursement_pending'
					? 'active'
					: 'pending',
		tone: purchase.status === 'paid' ? 'success' : 'default',
	};

	steps.push(paymentStep);
	return steps;
}

function resolveOperatorName(purchase: PurchaseDetail, operatorId: string): string {
	if (purchase.purchaser.id === operatorId) return purchase.purchaser.displayName || operatorId;
	if (purchase.approver?.id === operatorId) return purchase.approver.displayName;
	if (purchase.rejecter?.id === operatorId) return purchase.rejecter.displayName;
	if (purchase.payer?.id === operatorId) return purchase.payer.displayName;
	return operatorId;
}

function renderLogEntry(purchase: PurchaseDetail, log: ReimbursementLog) {
	const statusChange = `${getPurchaseStatusText(log.fromStatus)} → ${getPurchaseStatusText(log.toStatus)}`;
	return (
		<li key={log.id} className="rounded-xl border border-gray-100 p-3 text-xs dark:border-gray-800">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="font-semibold text-gray-900 dark:text-gray-100">{ACTION_LABELS[log.action] ?? log.action}</p>
				<time className="font-mono text-gray-500 dark:text-gray-400">{formatDateTime(log.createdAt) ?? '—'}</time>
			</div>
			<p className="mt-1 text-gray-600 dark:text-gray-300">状态 {statusChange}</p>
			<p className="text-gray-500 dark:text-gray-400">操作人 {resolveOperatorName(purchase, log.operatorId)}</p>
			{log.comment && <p className="mt-1 text-rose-600 dark:text-rose-300">备注：{log.comment}</p>}
		</li>
	);
}

function classifyLogToStep(log: ReimbursementLog): TimelineStep['key'] | 'other' {
	if (log.action === 'approve' || log.action === 'reject' || log.action === 'transfer') return 'approval';
	if (log.action === 'pay' || log.action === 'issue' || log.action === 'resolve') return 'payment';
	if (log.action === 'withdraw' || log.action === 'cancel') return 'submit';

	if (log.action === 'submit') {
		if (log.fromStatus === 'draft' && log.toStatus === 'draft') return 'draft';
		if (log.toStatus === 'pending_approval' || log.fromStatus === 'draft') return 'submit';
		if (log.fromStatus === 'approved' || log.fromStatus === 'paid') return 'reimbursement';
		return 'submit';
	}

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
	const timeline = buildTimeline(purchase);

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
			visible: Boolean(permissions?.canSubmitReimbursement),
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
			<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
				<div className="flex items-center justify-between gap-4">
					<div>
						<p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">当前状态</p>
						<div className="mt-2">
							<PurchaseStatusBadge status={purchase.status} />
						</div>
					</div>
					<div className="text-right text-xs text-gray-500 dark:text-gray-400">
						<div>最近更新</div>
						<div className="font-mono text-sm text-gray-700 dark:text-gray-300">{formatDateTime(purchase.updatedAt) ?? '—'}</div>
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
				<div className="mb-4 flex items-center justify-between gap-2">
					<div>
						<p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">审批流与日志</p>
						<h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">流程节点与操作记录</h4>
					</div>
					<span className="text-xs text-gray-500 dark:text-gray-400">按节点聚合展示</span>
				</div>
				<ol className="relative space-y-6 border-l border-gray-200 pl-6 dark:border-gray-800">
					{timeline.map((step) => (
						<li key={step.key} className="relative pl-2">
							<span className={`absolute -left-3 top-6 h-3 w-3 rounded-full border-2 ${STATUS_DOT_CLASS[step.status]}`}></span>
							<div
								className={cn(
									'flex flex-col gap-2 rounded-2xl border border-transparent bg-white/70 p-3 transition dark:bg-white/5',
									step.status === 'active' && 'border-sky-200 bg-sky-50 shadow-sm dark:border-sky-400/40 dark:bg-sky-400/10',
									step.status === 'done' && 'bg-emerald-50/60 dark:bg-emerald-500/10',
									step.status === 'pending' && 'bg-gray-50/60 dark:bg-gray-800/40'
								)}
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<p className={`text-sm font-semibold ${TONE_TEXT_CLASS[step.tone]}`}>{step.title}</p>
									<div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
										<span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STEP_STATUS_BADGE[step.status])}>{STEP_STATUS_LABEL[step.status]}</span>
										{formatDateTime(step.timestamp) && (
											<time>{formatDateTime(step.timestamp)}</time>
										)}
									</div>
								</div>
								<p className="text-xs text-gray-500 dark:text-gray-400">{step.description}</p>
								{step.note && (
									<p className="text-xs text-rose-500 dark:text-rose-300">{step.note}</p>
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

			<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
				<div className="flex items-center justify-between gap-2">
					<div>
						<p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">可执行动作</p>
						<h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">审批操作区</h4>
					</div>
					<span className="text-xs text-gray-500 dark:text-gray-400">根据权限自动展示</span>
				</div>
				<div className="mt-4 flex flex-wrap gap-2">
					{visibleActions.length === 0 && (
						<p className="text-xs text-gray-500 dark:text-gray-400">当前状态暂无可执行操作。</p>
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
