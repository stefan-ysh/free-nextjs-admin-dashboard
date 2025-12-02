import { z } from 'zod';
import { TransactionType, PaymentType, InvoiceType, InvoiceStatus } from '@/types/finance';

export const invoiceSchema = z.object({
  type: z.nativeEnum(InvoiceType).default(InvoiceType.NONE),
  status: z.nativeEnum(InvoiceStatus).default(InvoiceStatus.NOT_REQUIRED),
  number: z.string().optional(),
  issueDate: z.string().optional(), // ISO date string
  attachments: z.array(z.string()).optional(),
});

export const financeRecordSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  type: z.nativeEnum(TransactionType),
  category: z.string().min(1, '请选择分类'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, '日期格式不正确'), // YYYY-MM-DD
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
  sourceType: z.enum(['manual', 'purchase', 'project', 'import', 'inventory', 'project_payment']).optional(),
  purchaseId: z.string().optional(),
  supplierId: z.string().optional(),
  projectId: z.string().optional(),
  projectPaymentId: z.string().optional(),
  handlerId: z.string().optional(),
});

export type FinanceRecordFormValues = z.infer<typeof financeRecordSchema>;
