/**
 * Mock财务数据 - 用于开发环境测试
 */

import { FinanceRecord, TransactionType, PaymentType, InvoiceType, InvoiceStatus } from '@/types/finance';

export const mockRecords: FinanceRecord[] = [
  {
    id: '1',
    name: '办公室装修',
    type: TransactionType.EXPENSE,
    category: '装修费用',
    contractAmount: 50000,
    fee: 500,
    totalAmount: 50500,
    paymentType: PaymentType.DEPOSIT,
    date: '2024-01-15T00:00:00.000Z',
    description: '一层大厅装修工程',
    invoice: {
      type: InvoiceType.SPECIAL,
      status: InvoiceStatus.ISSUED,
      number: '12345678',
      issueDate: '2024-01-16T00:00:00.000Z',
      attachments: [],
    },
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  },
  {
    id: '2',
    name: '员工聚餐',
    type: TransactionType.EXPENSE,
    category: '餐费',
    contractAmount: 1200,
    fee: 0,
    totalAmount: 1200,
    paymentType: PaymentType.FULL_PAYMENT,
    date: '2024-01-10T00:00:00.000Z',
    description: '团队建设聚餐',
    createdAt: '2024-01-10T00:00:00.000Z',
    updatedAt: '2024-01-10T00:00:00.000Z',
  },
  {
    id: '3',
    name: '项目收入',
    type: TransactionType.INCOME,
    category: '收入',
    contractAmount: 100000,
    fee: 1000,
    totalAmount: 101000,
    paymentType: PaymentType.FULL_PAYMENT,
    date: '2024-01-05T00:00:00.000Z',
    description: '客户A项目款',
    invoice: {
      type: InvoiceType.GENERAL,
      status: InvoiceStatus.PENDING,
    },
    createdAt: '2024-01-05T00:00:00.000Z',
    updatedAt: '2024-01-05T00:00:00.000Z',
  },
];
