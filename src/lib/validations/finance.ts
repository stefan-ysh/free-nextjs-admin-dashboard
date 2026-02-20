import { z } from 'zod';
import { TransactionType, PaymentType, InvoiceType, InvoiceStatus } from '@/types/finance';
import { BudgetAdjustmentType, BudgetAdjustmentOrgType } from '@/types/finance';

export const invoiceSchema = z.object({
  type: z.nativeEnum(InvoiceType).default(InvoiceType.NONE),
  status: z.nativeEnum(InvoiceStatus).default(InvoiceStatus.NOT_REQUIRED),
  number: z.string().optional(),
  issueDate: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

export const financeRecordSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  type: z.nativeEnum(TransactionType),
  category: z.string().min(1, '请选择分类'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, '日期格式不正确'),
  contractAmount: z.number().min(0, '金额不能为负数'),
  fee: z.number().min(0, '手续费不能为负数'),
  quantity: z.number().min(0, '数量不能为负数').optional(),
  paymentType: z.nativeEnum(PaymentType),
  paymentChannel: z.string().max(120, '支付方式过长').optional(),
  payer: z.string().max(120, '代付人过长').optional(),
  transactionNo: z.string().max(160, '流水号过长').optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  invoice: invoiceSchema.optional(),
  status: z.enum(['draft', 'cleared']).optional(),
  sourceType: z.enum(['manual', 'reimbursement', 'budget_adjustment', 'inventory']).optional(),
  purchaseId: z.string().optional(),
  handlerId: z.string().optional(),
});

export type FinanceRecordFormValues = z.infer<typeof financeRecordSchema>;

export const budgetAdjustmentSchema = z.object({
  organizationType: z.enum(['school', 'company']).optional(),
  adjustmentType: z.enum(['increase', 'decrease']).default('increase'),
  amount: z.number({ message: '金额必须是数字' }).positive('金额必须大于 0'),
  title: z.string().min(1, '调整标题不能为空').max(200, '标题过长'),
  note: z.string().max(1000, '备注过长').nullable().optional(),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
});

export type BudgetAdjustmentFormValues = z.infer<typeof budgetAdjustmentSchema>;
