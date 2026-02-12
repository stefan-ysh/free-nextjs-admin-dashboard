import { PaymentType, InvoiceStatus, InvoiceType } from '@/types/finance';
import type { Supplier, SupplierStatus } from '@/types/supplier';


export { PaymentType, InvoiceStatus, InvoiceType } from '@/types/finance';

/**
 * 购买渠道
 */
export type PurchaseChannel = 'online' | 'offline';

/**
 * 采购组织
 */
export type PurchaseOrganization = 'school' | 'company';

/**
 * 付款方式
 */
export type PaymentMethod =
  | 'wechat' // 微信
  | 'alipay' // 支付宝
  | 'bank_transfer' // 银行转账
  | 'corporate_transfer' // 对公转账
  | 'cash'; // 现金

export const PAYMENT_TYPES: readonly PaymentType[] = [
  PaymentType.DEPOSIT,
  PaymentType.FULL_PAYMENT,
  PaymentType.INSTALLMENT,
  PaymentType.BALANCE,
  PaymentType.OTHER,
] as const;

export const INVOICE_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.PENDING,
  InvoiceStatus.ISSUED,
  InvoiceStatus.NOT_REQUIRED,
] as const;

/**
 * 采购状态
 */
export type PurchaseStatus = 
  | 'draft'             // 草稿
  | 'pending_approval'  // 待审批
  | 'approved'          // 已批准
  | 'rejected'          // 已驳回
  | 'paid'              // 已打款
  | 'cancelled';        // 已取消

export type ReimbursementStatus =
  | 'none'
  | 'invoice_pending'
  | 'reimbursement_pending'
  | 'reimbursement_rejected'
  | 'reimbursed';

export const PAYMENT_QUEUE_STATUSES = ['all', 'pending', 'processing', 'paid', 'issue'] as const;
export type PaymentQueueStatus = (typeof PAYMENT_QUEUE_STATUSES)[number];

/**
 * 采购记录
 */
export interface PurchaseRecord {
  id: string;
  purchaseNumber: string;
  
  // 基本信息
  purchaseDate: string;
  organizationType: PurchaseOrganization;
  itemName: string;
  inventoryItemId?: string | null;
  specification: string | null;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  feeAmount: number;
  
  // 购买信息
  purchaseChannel: PurchaseChannel;
  purchaseLocation: string | null;
  purchaseLink: string | null;
  purpose: string;
  
  // 付款信息
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  paymentChannel: string | null;
  payerName: string | null;
  transactionNo: string | null;
  purchaserId: string;

  // 供应商信息
  supplierId: string | null;
  supplierName?: string | null;
  supplierShortName?: string | null;
  supplierStatus?: SupplierStatus;
  
  // 发票信息
  invoiceType: InvoiceType;
  invoiceStatus: InvoiceStatus;
  invoiceNumber: string | null;
  invoiceIssueDate: string | null;
  invoiceImages: string[];
  receiptImages: string[];
  
  // 项目关联
  hasProject: boolean;
  projectId: string | null;
  
  // 状态流程
  status: PurchaseStatus;
  reimbursementStatus: ReimbursementStatus;
  reimbursementSubmittedAt: string | null;
  reimbursementSubmittedBy: string | null;
  reimbursementRejectedAt: string | null;
  reimbursementRejectedBy: string | null;
  reimbursementRejectedReason: string | null;
  pendingApproverId?: string | null;

  paymentIssueOpen?: boolean;
  paymentIssueReason?: string | null;
  paymentIssueAt?: string | null;
  paymentIssueBy?: string | null;
  
  // 审批信息
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  paidAt: string | null;
  paidBy: string | null;
  
  // 其他
  notes: string | null;
  attachments: string[];
  
  // 审计
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isDeleted: boolean;
  deletedAt: string | null;
}

/**
 * 创建采购记录输入
 */
export interface CreatePurchaseInput {
  purchaseDate: string;
  organizationType: PurchaseOrganization;
  itemName: string;
  inventoryItemId?: string;
  specification?: string;
  quantity: number;
  unitPrice: number;
  feeAmount?: number;
  
  purchaseChannel: PurchaseChannel;
  purchaseLocation?: string;  // 线下购买时必填
  purchaseLink?: string;      // 网购时必填
  purpose: string;
  
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  paymentChannel?: string | null; // Deprecated in UI
  payerName?: string | null; // Deprecated in UI
  transactionNo?: string | null; // Deprecated in UI
  purchaserId: string; // 默认当前用户
  supplierId?: string | null;
  
  hasInvoice: boolean; // New field
  invoiceType: InvoiceType;
  invoiceStatus?: InvoiceStatus;
  invoiceNumber?: string;
  invoiceIssueDate?: string;
  invoiceImages?: string[];
  receiptImages?: string[];
  
  hasProject?: boolean; // Deprecated in UI
  projectId?: string; // Deprecated in UI
  
  notes?: string;
  attachments?: string[];
}

/**
 * 更新采购记录输入（仅草稿和驳回状态可编辑）
 */
export interface UpdatePurchaseInput {
  purchaseDate?: string;
  organizationType?: PurchaseOrganization;
  itemName?: string;
  inventoryItemId?: string | null;
  specification?: string | null;
  quantity?: number;
  unitPrice?: number;
  feeAmount?: number;
  
  purchaseChannel?: PurchaseChannel;
  purchaseLocation?: string | null;
  purchaseLink?: string | null;
  purpose?: string;
  
  paymentMethod?: PaymentMethod;
  paymentType?: PaymentType;
  paymentChannel?: string | null;
  payerName?: string | null;
  transactionNo?: string | null;
  purchaserId?: string;
  supplierId?: string | null;
  
  invoiceType?: InvoiceType;
  invoiceStatus?: InvoiceStatus;
  invoiceNumber?: string | null;
  invoiceIssueDate?: string | null;
  invoiceImages?: string[];
  receiptImages?: string[];
  
  hasProject?: boolean;
  projectId?: string | null;
  
  notes?: string | null;
  attachments?: string[];
}

/**
 * 采购列表查询参数
 */
export interface ListPurchasesParams {
  search?: string;
  status?: PurchaseStatus | 'all';
  purchaserId?: string;
  purchaserDepartment?: string;
  projectId?: string;
  supplierId?: string;
  organizationType?: PurchaseOrganization;
  financeOrgType?: 'school' | 'company';
  pendingApproverId?: string;
  includeUnassignedApprovals?: boolean;
  purchaseChannel?: PurchaseChannel;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'purchaseDate' | 'totalAmount' | 'status' | 'submittedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 采购列表结果
 */
export interface ListPurchasesResult {
  items: PurchaseRecord[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 报销流程操作类型
 */
export type ReimbursementAction = 
  | 'submit'    // 提交报销
  | 'approve'   // 批准
  | 'reject'    // 驳回
  | 'pay'       // 打款
  | 'cancel'    // 取消
  | 'withdraw'  // 撤回
  | 'transfer'  // 转审
  | 'issue'     // 标记异常
  | 'resolve';  // 解除异常

/**
 * 报销流程日志
 */
export interface ReimbursementLog {
  id: string;
  purchaseId: string;
  action: ReimbursementAction;
  fromStatus: PurchaseStatus;
  toStatus: PurchaseStatus;
  operatorId: string;
  operatorName?: string | null;
  comment: string | null;
  createdAt: string;
}

export interface PurchaseAuditLogItem {
  id: string;
  purchaseId: string;
  purchaseNumber: string;
  itemName: string;
  action: ReimbursementAction;
  fromStatus: PurchaseStatus;
  toStatus: PurchaseStatus;
  operatorId: string;
  operatorName: string;
  comment: string | null;
  createdAt: string;
}

/**
 * 提交报销输入
 */
export interface SubmitReimbursementInput {
  purchaseId: string;
}

/**
 * 审批报销输入
 */
export interface ApproveReimbursementInput {
  purchaseId: string;
}

/**
 * 驳回报销输入
 */
export interface RejectReimbursementInput {
  purchaseId: string;
  reason: string;
}

/**
 * 标记已打款输入
 */
export interface MarkAsPaidInput {
  purchaseId: string;
  amount: number;
  note?: string | null;
}

/**
 * 撤回申请输入
 */
export interface WithdrawReimbursementInput {
  purchaseId: string;
}

/**
 * 采购详情（含关联信息）
 */
export interface PurchaseDetail extends PurchaseRecord {
  purchaser: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    employeeCode: string | null;
    department: string | null;
  };
  project: {
    id: string;
    projectCode: string;
    projectName: string;
  } | null;
  approver: {
    id: string;
    displayName: string;
  } | null;
  pendingApprover: {
    id: string;
    displayName: string;
  } | null;
  rejecter: {
    id: string;
    displayName: string;
  } | null;
  payer: {
    id: string;
    displayName: string;
  } | null;
  payments: PurchasePaymentDetail[];
  paidAmount: number;
  remainingAmount: number;
  dueAmount: number;
  logs: ReimbursementLog[];
  supplier: Supplier | null;
}

export type PurchasePaymentQueueItem = PurchaseRecord & {
  supplierName?: string | null;
  paidAmount: number;
  remainingAmount: number;
  purchaserName?: string | null;
  purchaserDepartment?: string | null;
  purchaserEmployeeCode?: string | null;
};

export interface PurchasePayment {
  id: string;
  purchaseId: string;
  amount: number;
  paidAt: string;
  paidBy: string;
  note: string | null;
  createdAt: string;
}

export interface PurchasePaymentDetail extends PurchasePayment {
  payer: {
    id: string;
    displayName: string;
  } | null;
}

/**
 * 采购统计信息
 */
export interface PurchaseStats {
  totalPurchases: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  paidCount: number;
  paidAmount: number;
}

export interface PurchaseMonitorStatusSummary {
  status: PurchaseStatus;
  count: number;
  amount: number;
}

export interface PurchaseMonitorAgingBucket {
  label: string;
  minHours: number;
  maxHours: number | null;
  count: number;
}

export interface PurchaseMonitorApproverLoad {
  approverId: string | null;
  approverName: string;
  pendingCount: number;
  totalPendingAmount: number;
  avgPendingHours: number;
  maxPendingHours: number;
}

export interface PurchaseMonitorStuckRecord {
  id: string;
  purchaseNumber: string;
  itemName: string;
  purchaserId: string;
  purchaserName: string;
  pendingApproverId: string | null;
  pendingApproverName: string;
  submittedAt: string | null;
  pendingHours: number;
  dueAmount: number;
}

export interface PurchaseMonitorData {
  generatedAt: string;
  overdueHours: number;
  activeCount: number;
  pendingApprovalCount: number;
  pendingPaymentCount: number;
  overdueApprovalCount: number;
  avgPendingHours: number;
  statusSummary: PurchaseMonitorStatusSummary[];
  agingBuckets: PurchaseMonitorAgingBucket[];
  approverLoad: PurchaseMonitorApproverLoad[];
  stuckRecords: PurchaseMonitorStuckRecord[];
}

/**
 * 个人采购统计
 */
export interface PersonalPurchaseStats extends PurchaseStats {
  draftCount: number;
  rejectedCount: number;
}

/**
 * 部门采购统计
 */
export interface DepartmentPurchaseStats {
  department: string;
  totalAmount: number;
  purchaseCount: number;
  employeeCount: number;
}

/**
 * 项目采购统计
 */
export interface ProjectPurchaseStats {
  projectId: string;
  projectName: string;
  totalAmount: number;
  purchaseCount: number;
  budget: number | null;
  budgetUtilization: number | null; // 预算使用率 %
}

export const PURCHASE_STATUSES: readonly PurchaseStatus[] = ['draft', 'pending_approval', 'approved', 'rejected', 'paid', 'cancelled'] as const;
export const REIMBURSEMENT_STATUSES: readonly ReimbursementStatus[] = [
  'none',
  'invoice_pending',
  'reimbursement_pending',
  'reimbursement_rejected',
  'reimbursed',
] as const;
export const PURCHASE_CHANNELS: readonly PurchaseChannel[] = ['online', 'offline'] as const;
export const PURCHASE_ORGANIZATIONS: readonly PurchaseOrganization[] = ['school', 'company'] as const;
export const PAYMENT_METHODS: readonly PaymentMethod[] = ['wechat', 'alipay', 'bank_transfer', 'corporate_transfer', 'cash'] as const;
export const INVOICE_TYPES: readonly InvoiceType[] = [
  InvoiceType.SPECIAL,
  InvoiceType.GENERAL,
  InvoiceType.NONE,
] as const;
export const REIMBURSEMENT_ACTIONS: readonly ReimbursementAction[] = [
  'submit',
  'approve',
  'reject',
  'pay',
  'cancel',
  'withdraw',
  'transfer',
  'issue',
  'resolve',
] as const;

export function isPurchaseStatus(value: string | null | undefined): value is PurchaseStatus {
  return value != null && PURCHASE_STATUSES.includes(value as PurchaseStatus);
}

export function isReimbursementStatus(value: string | null | undefined): value is ReimbursementStatus {
  return value != null && REIMBURSEMENT_STATUSES.includes(value as ReimbursementStatus);
}

export function isPurchaseChannel(value: string | null | undefined): value is PurchaseChannel {
  return value != null && PURCHASE_CHANNELS.includes(value as PurchaseChannel);
}

export function isPurchaseOrganization(value: string | null | undefined): value is PurchaseOrganization {
  return value != null && PURCHASE_ORGANIZATIONS.includes(value as PurchaseOrganization);
}

export function isPaymentMethod(value: string | null | undefined): value is PaymentMethod {
  return value != null && PAYMENT_METHODS.includes(value as PaymentMethod);
}

export function isInvoiceType(value: string | null | undefined): value is InvoiceType {
  return value != null && INVOICE_TYPES.includes(value as InvoiceType);
}

export function isPaymentType(value: string | null | undefined): value is PaymentType {
  return value != null && PAYMENT_TYPES.includes(value as PaymentType);
}

export function isPaymentQueueStatus(value: string | null | undefined): value is PaymentQueueStatus {
  return value != null && PAYMENT_QUEUE_STATUSES.includes(value as PaymentQueueStatus);
}

export function isInvoiceStatus(value: string | null | undefined): value is InvoiceStatus {
  return value != null && INVOICE_STATUSES.includes(value as InvoiceStatus);
}

export function isReimbursementAction(value: string | null | undefined): value is ReimbursementAction {
  return value != null && REIMBURSEMENT_ACTIONS.includes(value as ReimbursementAction);
}

/**
 * 辅助函数：判断采购是否可编辑
 */
export function isPurchaseEditable(status: PurchaseStatus): boolean {
  return status === 'draft' || status === 'rejected';
}

/**
 * 辅助函数：判断采购是否可删除
 */
export function isPurchaseDeletable(status: PurchaseStatus): boolean {
  return status === 'draft' || status === 'rejected';
}

/**
 * 辅助函数：判断采购是否可提交
 */
export function isPurchaseSubmittable(status: PurchaseStatus): boolean {
  return status === 'draft' || status === 'rejected';
}

/**
 * 判断是否具备报销所需的发票凭证
 */
export function hasInvoiceEvidence(purchase: Pick<PurchaseRecord, 'invoiceImages' | 'invoiceStatus' | 'invoiceType'>): boolean {
  if (purchase.invoiceType === 'none') return true;
  if (purchase.invoiceStatus === InvoiceStatus.NOT_REQUIRED) return true;
  const files = Array.isArray(purchase.invoiceImages) ? purchase.invoiceImages.filter(Boolean) : [];
  return files.length > 0;
}

/**
 * 辅助函数：判断采购是否可撤回
 */
export function isPurchaseWithdrawable(status: PurchaseStatus): boolean {
  return status === 'pending_approval';
}

/**
 * 辅助函数：判断采购是否可审批
 */
export function isPurchaseApprovable(status: PurchaseStatus): boolean {
  return status === 'pending_approval';
}

/**
 * 辅助函数：判断采购是否可标记已打款
 */
export function isPurchasePayable(status: PurchaseStatus): boolean {
  return status === 'approved';
}

export function isReimbursementSubmittable(
  purchase: Pick<PurchaseRecord, 'status' | 'reimbursementStatus'>
): boolean {
  return purchase.status === 'approved' && purchase.reimbursementStatus === 'invoice_pending';
}

/**
 * 辅助函数：获取状态显示文本
 */
export function getPurchaseStatusText(status: PurchaseStatus): string {
  const statusMap: Record<PurchaseStatus, string> = {
    draft: '草稿',
    pending_approval: '待审批',
    approved: '已批准',
    rejected: '已驳回',
    paid: '已打款',
    cancelled: '已取消',
  };
  return statusMap[status];
}

export function getReimbursementStatusText(status: ReimbursementStatus): string {
  const statusMap: Record<ReimbursementStatus, string> = {
    none: '未进入报销',
    invoice_pending: '待补发票',
    reimbursement_pending: '待财务确认',
    reimbursement_rejected: '报销被驳回',
    reimbursed: '报销完成',
  };
  return statusMap[status];
}

/**
 * 辅助函数：获取支付方式显示文本
 */
export function getPaymentMethodText(method: PaymentMethod): string {
  const methodMap: Record<PaymentMethod, string> = {
    wechat: '微信',
    alipay: '支付宝',
    bank_transfer: '银行转账',
    corporate_transfer: '对公转账',
    cash: '现金',
  };
  return methodMap[method];
}

/**
 * 辅助函数：获取发票类型显示文本
 */
export function getInvoiceTypeText(type: InvoiceType): string {
  const typeMap: Record<InvoiceType, string> = {
    special: '专票',
    general: '普票',
    none: '无发票',
  };
  return typeMap[type];
}
