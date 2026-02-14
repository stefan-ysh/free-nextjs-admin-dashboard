import { InvoiceType as FinanceInvoiceType, FinanceRecord, FinanceRecordMetadata, InvoiceInfo, InvoiceStatus, PaymentType, TransactionType } from '@/types/finance';
import { getDefaultCategoryLabels, matchCategoryLabel } from '@/constants/finance-categories';

import type { PurchaseRecord } from '@/types/purchase';
import type { ProjectPayment, ProjectRecord } from '@/types/project';
import {
  createRecord,
  findRecordByPurchasePaymentId,
  findRecordByProjectPaymentId,
  updateRecord,
} from '@/lib/db/finance';
import { findProjectById } from '@/lib/db/projects';

const DEFAULT_EXPENSE_CATEGORY = getDefaultCategoryLabels(TransactionType.EXPENSE)[0];
const PURCHASE_EXPENSE_CATEGORY =
  matchCategoryLabel(TransactionType.EXPENSE, '采购支出') ?? DEFAULT_EXPENSE_CATEGORY;

function toIsoDateString(value?: string | Date | null): string {
  if (!value) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return new Date().toISOString();
    const normalized = trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function buildPurchaseInvoice(purchase: PurchaseRecord): InvoiceInfo | undefined {
  const attachments = purchase.invoiceImages.filter(Boolean);
  if (purchase.invoiceType === FinanceInvoiceType.NONE) {
    return undefined;
  }
  return {
    type: purchase.invoiceType,
    status: purchase.invoiceStatus,
    number: purchase.invoiceNumber ?? undefined,
    issueDate: purchase.invoiceIssueDate ?? undefined,
    attachments: attachments.length ? attachments : undefined,
  };
}

function buildPurchaseMetadata(purchase: PurchaseRecord): FinanceRecordMetadata {
  return {
    purchaseNumber: purchase.purchaseNumber,
    purchaserId: purchase.purchaserId,
    approvedBy: purchase.approvedBy ?? undefined,
    approvedAt: purchase.approvedAt ?? undefined,
    paidBy: purchase.paidBy ?? undefined,
    paidAt: purchase.paidAt ?? undefined,
  };
}

function buildPurchaseDescription(purchase: PurchaseRecord): string {
  if (purchase.notes?.trim()) return purchase.notes.trim();
  if (purchase.purpose?.trim()) return purchase.purpose.trim();
  return `采购单号：${purchase.purchaseNumber}`;
}

function buildPurchaseTags(_purchase: PurchaseRecord): string[] | undefined {
  const tags: string[] = [];
  tags.push('来源:采购');
  return tags.length ? tags : undefined;
}





function normalizePaymentMetadata(metadata?: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function pickString(meta: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return undefined;
}

function pickNumber(meta: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function resolveMilestoneTitle(project: ProjectRecord | null | undefined, milestoneId?: string | null): string | undefined {
  if (!project || !milestoneId) return undefined;
  return project.milestones?.find((milestone) => milestone.id === milestoneId)?.title ?? undefined;
}

function buildProjectIncomeName(payment: ProjectPayment, project?: ProjectRecord | null): string {
  const projectLabel = project?.projectName?.trim();
  if (projectLabel) {
    return `项目收入 - ${projectLabel} - ${payment.title}`;
  }
  return `项目收入 - ${payment.title}`;
}

function formatDateLabel(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const iso = toIsoDateString(value);
    return iso.slice(0, 10);
  } catch {
    return undefined;
  }
}

function buildProjectIncomeDescription(
  payment: ProjectPayment,
  project?: ProjectRecord | null,
  milestoneTitle?: string
): string {
  const segments: string[] = [];
  if (project?.projectName) {
    segments.push(`项目：${project.projectName}`);
  }
  if (project?.clientName) {
    segments.push(`客户：${project.clientName}`);
  }
  segments.push(`款项：${payment.title}`);
  if (milestoneTitle) {
    segments.push(`里程碑：${milestoneTitle}`);
  }
  const expected = formatDateLabel(payment.expectedDate);
  if (expected) {
    segments.push(`计划收款：${expected}`);
  }
  const received = formatDateLabel(payment.receivedDate ?? undefined);
  if (received) {
    segments.push(`到账：${received}`);
  }
  if (payment.notes?.trim()) {
    segments.push(payment.notes.trim());
  }
  if (payment.description?.trim()) {
    segments.push(payment.description.trim());
  }
  return segments.join(' | ') || `项目收款：${payment.id}`;
}

function buildProjectIncomeTags(
  payment: ProjectPayment,
  project?: ProjectRecord | null,
  milestoneTitle?: string
): string[] | undefined {
  const tags = new Set<string>();
  tags.add('来源:项目');
  if (project?.projectName) {
    tags.add(`项目:${project.projectName}`);
  }
  if (project?.projectCode) {
    tags.add(`项目编号:${project.projectCode}`);
  }
  if (project?.clientName) {
    tags.add(`客户:${project.clientName}`);
  }
  if (milestoneTitle) {
    tags.add(`里程碑:${milestoneTitle}`);
  }
  tags.add(`状态:${payment.status}`);
  tags.add(`款项:${payment.title}`);
  return tags.size ? Array.from(tags) : undefined;
}

function buildProjectIncomeMetadata(
  payment: ProjectPayment,
  project?: ProjectRecord | null,
  milestoneTitle?: string
): FinanceRecordMetadata {
  const metadata: FinanceRecordMetadata = {
    projectPayment: {
      id: payment.id,
      title: payment.title,
      amount: payment.amount,
      status: payment.status,
      milestoneId: payment.milestoneId ?? undefined,
      milestoneTitle,
      expectedDate: payment.expectedDate,
      receivedDate: payment.receivedDate ?? undefined,
      notes: payment.notes,
      description: payment.description,
      metadata: payment.metadata,
    },
  };

  if (project) {
    metadata.project = {
      id: project.id,
      code: project.projectCode,
      name: project.projectName,
      clientName: project.clientName,
      managerId: project.projectManagerId,
    };
  }

  return metadata;
}

function buildProjectPaymentInvoice(payment: ProjectPayment): InvoiceInfo | undefined {
  if (payment.invoiceType === FinanceInvoiceType.NONE) {
    return undefined;
  }

  const attachments = (payment.invoiceAttachments ?? []).filter((file) => typeof file === 'string' && file.trim());
  const issueDate = payment.invoiceIssueDate ? toIsoDateString(payment.invoiceIssueDate) : undefined;
  const invoiceStatus = issueDate || payment.status === 'invoiced' || payment.status === 'received'
    ? InvoiceStatus.ISSUED
    : InvoiceStatus.PENDING;

  return {
    type: payment.invoiceType ?? FinanceInvoiceType.NONE,
    status: invoiceStatus,
    number: payment.invoiceNumber ?? undefined,
    issueDate,
    attachments: attachments.length ? attachments : undefined,
  };
}

function isPaymentType(value: unknown): value is PaymentType {
  return typeof value === 'string' && (Object.values(PaymentType) as string[]).includes(value);
}

function inferProjectPaymentType(payment: ProjectPayment): PaymentType {
  const meta = normalizePaymentMetadata(payment.metadata);
  const metaValue = pickString(meta, ['paymentType', 'payment_type']);
  if (isPaymentType(metaValue)) {
    return metaValue;
  }

  const combined = `${payment.title ?? ''} ${payment.description ?? ''}`;
  const lower = combined.toLowerCase();

  if (combined.includes('定金') || combined.includes('预付款') || lower.includes('deposit') || lower.includes('advance')) {
    return PaymentType.DEPOSIT;
  }
  if (combined.includes('尾款') || combined.includes('结算') || lower.includes('balance') || lower.includes('final')) {
    return PaymentType.BALANCE;
  }
  if (!payment.milestoneId && (combined.includes('全款') || lower.includes('full'))) {
    return PaymentType.FULL_PAYMENT;
  }

  return payment.milestoneId ? PaymentType.INSTALLMENT : PaymentType.FULL_PAYMENT;
}

function resolveProjectPaymentFee(payment: ProjectPayment): number {
  const meta = normalizePaymentMetadata(payment.metadata);
  const value = pickNumber(meta, ['fee', 'feeAmount', 'bankFee', 'serviceFee']);
  if (typeof value !== 'number') {
    return 0;
  }
  return Math.max(0, Number(value.toFixed(2)));
}

function resolveProjectPaymentChannel(payment: ProjectPayment): string | undefined {
  const meta = normalizePaymentMetadata(payment.metadata);
  return pickString(meta, ['paymentChannel', 'channel', 'payChannel', 'bankAccount', 'receivingAccount']);
}

function resolveProjectPaymentTransactionNo(payment: ProjectPayment): string | undefined {
  const meta = normalizePaymentMetadata(payment.metadata);
  return pickString(meta, ['transactionNo', 'referenceNo', 'receiptNo', 'voucherNo']);
}

function resolveProjectIncomePayer(payment: ProjectPayment, project?: ProjectRecord | null): string | undefined {
  const meta = normalizePaymentMetadata(payment.metadata);
  return pickString(meta, ['payer', 'payor', 'customerName', 'clientName']) ?? project?.clientName ?? undefined;
}

export async function createPurchaseExpense(
  purchase: PurchaseRecord,
  paymentId: string,
  paymentAmount: number,
  operatorId: string,
  paymentDate: string
): Promise<FinanceRecord> {
  const basePayload = {
    name: purchase.itemName,
    type: TransactionType.EXPENSE,
    category: PURCHASE_EXPENSE_CATEGORY,
    date: toIsoDateString(paymentDate),
    contractAmount: paymentAmount,
    fee: 0,
    quantity: 1,
    paymentType: purchase.paymentType,
    paymentChannel: purchase.paymentChannel ?? undefined,
    payer: purchase.payerName ?? undefined,
    transactionNo: purchase.transactionNo ?? undefined,
    invoice: buildPurchaseInvoice(purchase),
    description: buildPurchaseDescription(purchase),
    tags: buildPurchaseTags(purchase),
    createdBy: operatorId,
    sourceType: 'purchase' as const,
    status: 'cleared' as const,
    purchaseId: purchase.id,
    purchasePaymentId: paymentId,
    projectId: undefined,
    metadata: {
      ...buildPurchaseMetadata(purchase),
      paymentAmount,
    },
  } satisfies Omit<FinanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'totalAmount'>;

  const existing = await findRecordByPurchasePaymentId(paymentId);
  if (existing) {
    const updated = await updateRecord(existing.id, basePayload);
    if (!updated) {
      throw new Error('FAILED_TO_UPDATE_FINANCE_RECORD');
    }
    return updated;
  }

  return createRecord(basePayload);
}


export type ProjectIncomeOptions = {
  project?: ProjectRecord | null;
};

export async function createProjectIncome(
  payment: ProjectPayment,
  operatorId: string,
  options: ProjectIncomeOptions = {}
): Promise<FinanceRecord | null> {
  if (!payment) {
    throw new Error('PROJECT_PAYMENT_REQUIRED');
  }
  if (!payment.projectId) {
    throw new Error('PROJECT_PAYMENT_PROJECT_REQUIRED');
  }

  const amount = Number(payment.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    console.warn('[finance-automation] 项目收款金额无效，跳过自动记账', payment.id);
    return null;
  }

  const project = options.project ?? (await findProjectById(payment.projectId).catch(() => null));
  const milestoneTitle = resolveMilestoneTitle(project, payment.milestoneId);
  const metadata = buildProjectIncomeMetadata(payment, project ?? undefined, milestoneTitle);
  const description = buildProjectIncomeDescription(payment, project ?? undefined, milestoneTitle);
  const tags = buildProjectIncomeTags(payment, project ?? undefined, milestoneTitle);
  const invoice = buildProjectPaymentInvoice(payment);
  const paymentType = inferProjectPaymentType(payment);
  const fee = resolveProjectPaymentFee(payment);
  const paymentChannel = resolveProjectPaymentChannel(payment);
  const payer = resolveProjectIncomePayer(payment, project ?? undefined);
  const transactionNo = resolveProjectPaymentTransactionNo(payment);
  const recordDate = toIsoDateString(payment.receivedDate ?? payment.expectedDate);
  const status = payment.status === 'received' ? 'cleared' : 'draft';
  const category = '项目收入';

  const basePayload = {
    name: buildProjectIncomeName(payment, project ?? undefined),
    type: TransactionType.INCOME,
    category,
    date: recordDate,
    contractAmount: Number(amount.toFixed(2)),
    fee,
    quantity: 1,
    paymentType,
    paymentChannel,
    payer,
    transactionNo,
    invoice,
    description,
    tags,
    createdBy: operatorId,
    sourceType: 'project_payment' as const,
    status,
    purchaseId: undefined,
    projectId: payment.projectId,
    inventoryMovementId: undefined,
    projectPaymentId: payment.id,
    metadata,
  } satisfies Omit<FinanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'totalAmount'>;

  const existing = await findRecordByProjectPaymentId(payment.id);

  if (payment.status === 'cancelled') {
    if (existing) {
      const updated = await updateRecord(existing.id, {
        ...basePayload,
        status: 'draft',
      });
      if (!updated) {
        throw new Error('FAILED_TO_UPDATE_FINANCE_RECORD');
      }
      return updated;
    }
    return null;
  }

  if (existing) {
    const updated = await updateRecord(existing.id, basePayload);
    if (!updated) {
      throw new Error('FAILED_TO_UPDATE_FINANCE_RECORD');
    }
    return updated;
  }

  return createRecord(basePayload);
}
