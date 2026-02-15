/**
 * 财务记录类型定义
 */

// 交易类型
export enum TransactionType {
  INCOME = 'income',    // 收入
  EXPENSE = 'expense',  // 支出
}

// 款项类型
export enum PaymentType {
  DEPOSIT = 'deposit',        // 定金
  FULL_PAYMENT = 'full',      // 全款
  INSTALLMENT = 'installment', // 分期
  BALANCE = 'balance',        // 尾款
  OTHER = 'other',            // 其他
}

// 发票类型
export enum InvoiceType {
  SPECIAL = 'special',      // 专票(增值税专用发票)
  GENERAL = 'general',      // 普票(普通发票)
  NONE = 'none',           // 无需发票
}

// 开票状态
export enum InvoiceStatus {
  ISSUED = 'issued',        // 已开票
  PENDING = 'pending',      // 待开票
  NOT_REQUIRED = 'not_required', // 无需开票
}

// 发票信息
export interface InvoiceInfo {
  type: InvoiceType;           // 发票类型
  status: InvoiceStatus;       // 开票状态
  number?: string;             // 发票号码
  issueDate?: string;          // 开票日期
  attachments?: string[];      // 发票附件URL列表
}

// 财务记录接口
export type FinanceSourceType = 'manual' | 'purchase' | 'import' | 'inventory';
export type FinanceRecordStatus = 'draft' | 'cleared';
export type FinanceRecordMetadata = Record<string, unknown>;

export interface FinanceRecord {
  id: string;

  // 基本信息
  name: string;                    // 明细名称(如:办公室装修、员工工资等)
  date: string;                    // 交易日期 (ISO string)
  category: string;                // 分类(如:差旅费、办公费-快递与邮寄、项目收入等)
  type: TransactionType;           // 收支类型
  status: FinanceRecordStatus;     // 流水状态(草稿/已确认)

  // 金额信息
  contractAmount: number;          // 合同金额
  fee: number;                     // 手续费
  totalAmount: number;             // 总金额(合同金额 + 手续费,自动计算)
  quantity?: number;               // 数量/件数

  // 款项信息
  paymentType: PaymentType;        // 款项类型
  paymentChannel?: string;         // 支付方式(公对公/公对私等)
  payer?: string;                  // 代付人
  transactionNo?: string;          // 流水号

  // 发票信息
  invoice?: InvoiceInfo;           // 发票信息(可选)

  // 其他信息
  description?: string;            // 备注描述
  tags?: string[];                 // 标签
  sourceType?: FinanceSourceType;  // 数据来源
  purchaseId?: string | null;      // 关联采购记录
  purchasePaymentId?: string | null; // 关联采购打款记录
  inventoryMovementId?: string | null; // 关联库存流水
  metadata?: FinanceRecordMetadata; // 额外元数据(JSON)

  // 系统字段
  createdAt: string;               // 创建时间
  updatedAt: string;               // 更新时间
  createdBy?: string;              // 创建人
}

// 表单提交/创建记录时使用的输入类型
export type FinanceRecordInput = Omit<FinanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'totalAmount'>;

// 分类接口
export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon?: string;
  color?: string;
  isDefault?: boolean;          // 是否默认分类
}

// 统计数据接口
export interface FinanceStats {
  totalIncome: number;          // 总收入
  totalExpense: number;         // 总支出
  balance: number;              // 余额
  recordCount: number;          // 记录数

  // 发票统计
  invoiceStats?: {
    issued: number;             // 已开票金额
    pending: number;            // 待开票金额
    notRequired: number;        // 无需开票金额
  };

  // 款项统计
  paymentStats?: {
    deposit: number;            // 定金
    full: number;              // 全款
    installment: number;       // 分期
    balance: number;           // 尾款
  };

  categoryStats: CategoryStat[];  // 分类统计
}

// 月度统计
export interface MonthlyStat {
  month: string;                // 月份 (YYYY-MM)
  income: number;               // 收入
  expense: number;              // 支出
  balance: number;              // 结余
  recordCount: number;          // 记录数
}

// 分类统计
export interface CategoryStat {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

// 查询参数
export interface FinanceQuery {
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  category?: string;
  month?: string;                   // 按月份筛选 (YYYY-MM)
  paymentType?: PaymentType;        // 按款项类型筛选
  invoiceStatus?: InvoiceStatus;    // 按开票状态筛选
  invoiceType?: InvoiceType;        // 按发票类型筛选
  minAmount?: number;
  maxAmount?: number;
  keyword?: string;                 // 关键词搜索(名称/备注)
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'amount' | 'createdAt';  // 排序字段
  sortOrder?: 'asc' | 'desc';       // 排序方向
}

// API 响应
export interface FinanceApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
