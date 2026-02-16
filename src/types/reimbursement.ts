export type ReimbursementSourceType = 'purchase' | 'direct';

export type ReimbursementStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'paid';

export type ReimbursementOrganizationType = 'school' | 'company';

export const REIMBURSEMENT_SOURCE_TYPES: readonly ReimbursementSourceType[] = ['purchase', 'direct'] as const;
export const REIMBURSEMENT_STATUSES: readonly ReimbursementStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'paid',
] as const;
export const REIMBURSEMENT_ORGANIZATION_TYPES: readonly ReimbursementOrganizationType[] = [
  'school',
  'company',
] as const;

export const REIMBURSEMENT_CATEGORY_OPTIONS = [
  '交通',
  '餐饮',
  '差旅',
  '办公',
  '招待',
  '物流',
  '采购报销',
  '其他',
] as const;

export type ReimbursementCategory = (typeof REIMBURSEMENT_CATEGORY_OPTIONS)[number] | string;

export interface ReimbursementRecord {
  id: string;
  reimbursementNumber: string;
  sourceType: ReimbursementSourceType;
  sourcePurchaseId: string | null;
  sourcePurchaseNumber: string | null;
  organizationType: ReimbursementOrganizationType;
  category: ReimbursementCategory;
  title: string;
  amount: number;
  occurredAt: string;
  description: string | null;
  invoiceImages: string[];
  receiptImages: string[];
  attachments: string[];
  status: ReimbursementStatus;
  pendingApproverId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  paidAt: string | null;
  paidBy: string | null;
  paymentNote: string | null;
  applicantId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReimbursementInput {
  sourceType: ReimbursementSourceType;
  sourcePurchaseId?: string | null;
  organizationType?: ReimbursementOrganizationType;
  category: ReimbursementCategory;
  title: string;
  amount: number;
  occurredAt: string;
  description?: string | null;
  invoiceImages?: string[];
  receiptImages?: string[];
  attachments?: string[];
  applicantId?: string;
}

export interface UpdateReimbursementInput {
  sourceType?: ReimbursementSourceType;
  sourcePurchaseId?: string | null;
  organizationType?: ReimbursementOrganizationType;
  category?: ReimbursementCategory;
  title?: string;
  amount?: number;
  occurredAt?: string;
  description?: string | null;
  invoiceImages?: string[];
  receiptImages?: string[];
  attachments?: string[];
}

export interface ListReimbursementsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ReimbursementStatus;
  sourceType?: ReimbursementSourceType;
  organizationType?: ReimbursementOrganizationType;
  category?: string;
  currentUserId: string;
  scope?: 'mine' | 'approval' | 'pay' | 'all';
  financeOrgType?: ReimbursementOrganizationType | null;
}

export interface ListReimbursementsResult {
  items: ReimbursementRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export type ReimbursementAction = 'create' | 'submit' | 'approve' | 'reject' | 'withdraw' | 'pay';

export interface ReimbursementLog {
  id: string;
  reimbursementId: string;
  action: ReimbursementAction;
  fromStatus: ReimbursementStatus;
  toStatus: ReimbursementStatus;
  operatorId: string;
  comment: string | null;
  createdAt: string;
}

export function isReimbursementStatus(value: string | null | undefined): value is ReimbursementStatus {
  return value != null && REIMBURSEMENT_STATUSES.includes(value as ReimbursementStatus);
}

export function isReimbursementSourceType(value: string | null | undefined): value is ReimbursementSourceType {
  return value != null && REIMBURSEMENT_SOURCE_TYPES.includes(value as ReimbursementSourceType);
}

export function isReimbursementOrganizationType(
  value: string | null | undefined
): value is ReimbursementOrganizationType {
  return value != null && REIMBURSEMENT_ORGANIZATION_TYPES.includes(value as ReimbursementOrganizationType);
}

