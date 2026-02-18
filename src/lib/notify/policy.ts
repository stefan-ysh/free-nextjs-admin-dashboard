export type PurchaseNotifyEvent =
  | 'purchase_submitted'
  | 'purchase_approved'
  | 'purchase_rejected'
  | 'purchase_transferred'
  | 'reimbursement_submitted'
  | 'purchase_paid'
  | 'payment_issue_marked'
  | 'payment_issue_resolved';

export type NotifyChannel = 'in_app' | 'email';

export type NotifyPolicyRule = {
  enabled: boolean;
  channels: NotifyChannel[];
};

export type NotifyPolicyMap = Record<PurchaseNotifyEvent, NotifyPolicyRule>;

const DEFAULT_NOTIFY_POLICY: NotifyPolicyMap = {
  purchase_submitted: { enabled: true, channels: ['in_app', 'email'] },
  purchase_approved: { enabled: true, channels: ['in_app', 'email'] },
  purchase_rejected: { enabled: true, channels: ['in_app', 'email'] },
  purchase_transferred: { enabled: true, channels: ['in_app', 'email'] },
  reimbursement_submitted: { enabled: true, channels: ['in_app', 'email'] },
  purchase_paid: { enabled: true, channels: ['in_app', 'email'] },
  payment_issue_marked: { enabled: true, channels: ['in_app', 'email'] },
  payment_issue_resolved: { enabled: true, channels: ['in_app', 'email'] },
};

let cachedRaw = '';
let cachedPolicy: NotifyPolicyMap = DEFAULT_NOTIFY_POLICY;

function isNotifyChannel(value: unknown): value is NotifyChannel {
  return value === 'in_app' || value === 'email';
}

function normalizeRule(raw: unknown, fallback: NotifyPolicyRule): NotifyPolicyRule {
  if (!raw || typeof raw !== 'object') return fallback;
  const record = raw as { enabled?: unknown; channels?: unknown };

  const enabled = typeof record.enabled === 'boolean' ? record.enabled : fallback.enabled;
  const channels = Array.isArray(record.channels)
    ? Array.from(new Set(record.channels.filter(isNotifyChannel)))
    : fallback.channels;

  return {
    enabled,
    channels: channels.length > 0 ? channels : fallback.channels,
  };
}

function parseNotifyPolicy(raw: string | undefined): NotifyPolicyMap {
  if (!raw?.trim()) return DEFAULT_NOTIFY_POLICY;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<PurchaseNotifyEvent, unknown>>;
    return {
      purchase_submitted: normalizeRule(parsed.purchase_submitted, DEFAULT_NOTIFY_POLICY.purchase_submitted),
      purchase_approved: normalizeRule(parsed.purchase_approved, DEFAULT_NOTIFY_POLICY.purchase_approved),
      purchase_rejected: normalizeRule(parsed.purchase_rejected, DEFAULT_NOTIFY_POLICY.purchase_rejected),
      purchase_transferred: normalizeRule(parsed.purchase_transferred, DEFAULT_NOTIFY_POLICY.purchase_transferred),
      reimbursement_submitted: normalizeRule(parsed.reimbursement_submitted, DEFAULT_NOTIFY_POLICY.reimbursement_submitted),
      purchase_paid: normalizeRule(parsed.purchase_paid, DEFAULT_NOTIFY_POLICY.purchase_paid),
      payment_issue_marked: normalizeRule(parsed.payment_issue_marked, DEFAULT_NOTIFY_POLICY.payment_issue_marked),
      payment_issue_resolved: normalizeRule(parsed.payment_issue_resolved, DEFAULT_NOTIFY_POLICY.payment_issue_resolved),
    };
  } catch (error) {
    console.warn('[notify] NOTIFY_POLICY_JSON parse failed, fallback to defaults', error);
    return DEFAULT_NOTIFY_POLICY;
  }
}

export function getNotifyPolicy(): NotifyPolicyMap {
  const raw = process.env.NOTIFY_POLICY_JSON ?? '';
  if (raw === cachedRaw) return cachedPolicy;
  cachedRaw = raw;
  cachedPolicy = parseNotifyPolicy(raw);
  return cachedPolicy;
}
