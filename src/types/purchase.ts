/**
 * 购买渠道
 */
export type PurchaseChannel = 'online' | 'offline';

/**
 * 付款方式
 */
export type PaymentMethod = 
  | 'wechat'              // 微信
  | 'alipay'              // 支付宝
  | 'bank_transfer'       // 银行转账
  | 'corporate_transfer'  // 对公转账
  | 'cash';               // 现金

/**
 * 发票类型
 */
export type InvoiceType = 
  | 'special'   // 专票
  | 'general'   // 普票
  | 'none';     // 无发票

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

/**
 * 采购记录
 */
export interface PurchaseRecord {
  id: string;
  purchaseNumber: string;
  
  // 基本信息
  purchaseDate: string;
  itemName: string;
  specification: string | null;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  
  // 购买信息
  purchaseChannel: PurchaseChannel;
  purchaseLocation: string | null;
  purchaseLink: string | null;
  purpose: string;
  
  // 付款信息
  paymentMethod: PaymentMethod;
  purchaserId: string;
  
  // 发票信息
  invoiceType: InvoiceType;
  invoiceImages: string[];
  receiptImages: string[];
  
  // 项目关联
  hasProject: boolean;
  projectId: string | null;
  
  // 状态流程
  status: PurchaseStatus;
  
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
  itemName: string;
  specification?: string;
  quantity: number;
  unitPrice: number;
  
  purchaseChannel: PurchaseChannel;
  purchaseLocation?: string;  // 线下购买时必填
  purchaseLink?: string;      // 网购时必填
  purpose: string;
  
  paymentMethod: PaymentMethod;
  purchaserId?: string;  // 默认当前用户
  
  invoiceType: InvoiceType;
  invoiceImages?: string[];
  receiptImages?: string[];
  
  hasProject: boolean;
  projectId?: string;
  
  notes?: string;
  attachments?: string[];
}

/**
 * 更新采购记录输入（仅草稿和驳回状态可编辑）
 */
export interface UpdatePurchaseInput {
  purchaseDate?: string;
  itemName?: string;
  specification?: string | null;
  quantity?: number;
  unitPrice?: number;
  
  purchaseChannel?: PurchaseChannel;
  purchaseLocation?: string | null;
  purchaseLink?: string | null;
  purpose?: string;
  
  paymentMethod?: PaymentMethod;
  purchaserId?: string;
  
  invoiceType?: InvoiceType;
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
  projectId?: string;
  purchaseChannel?: PurchaseChannel;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'purchaseDate' | 'totalAmount' | 'status';
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
  | 'withdraw'; // 撤回

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
  rejecter: {
    id: string;
    displayName: string;
  } | null;
  payer: {
    id: string;
    displayName: string;
  } | null;
  logs: ReimbursementLog[];
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
