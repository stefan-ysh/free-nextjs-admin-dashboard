import { InvoiceType as FinanceInvoiceType, FinanceRecord, FinanceRecordMetadata, InvoiceInfo, InvoiceStatus, PaymentType, TransactionType } from '@/types/finance';
import { getDefaultCategoryLabels, matchCategoryLabel } from '@/constants/finance-categories';

import type { PurchaseRecord } from '@/types/purchase';
import type { InventoryMovement, InventoryItem, Warehouse } from '@/types/inventory';
import type { ProjectPayment, ProjectRecord } from '@/types/project';
import { getInventoryItem, getWarehouse } from '@/lib/db/inventory';
import {
  createRecord,
  findRecordByPurchaseId,
  findRecordByInventoryMovementId,
  findRecordByProjectPaymentId,
  updateRecord,
} from '@/lib/db/finance';
import { findProjectById } from '@/lib/db/projects';

const DEFAULT_EXPENSE_CATEGORY = getDefaultCategoryLabels(TransactionType.EXPENSE)[0];
const DEFAULT_INCOME_CATEGORY = getDefaultCategoryLabels(TransactionType.INCOME)[0];
const PURCHASE_EXPENSE_CATEGORY =
  matchCategoryLabel(TransactionType.EXPENSE, '采购支出') ?? DEFAULT_EXPENSE_CATEGORY;
const SALE_INCOME_CATEGORY =
  matchCategoryLabel(TransactionType.INCOME, '销售收入') ?? DEFAULT_INCOME_CATEGORY;

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
    projectId: purchase.projectId ?? undefined,
    supplier: purchase.supplierId
      ? {
          id: purchase.supplierId,
          name: purchase.supplierName,
          shortName: purchase.supplierShortName,
          status: purchase.supplierStatus,
        }
      : undefined,
  };
}

function buildPurchaseDescription(purchase: PurchaseRecord): string {
  if (purchase.notes?.trim()) return purchase.notes.trim();
  if (purchase.purpose?.trim()) return purchase.purpose.trim();
  return `采购单号：${purchase.purchaseNumber}`;
}

function buildPurchaseTags(purchase: PurchaseRecord): string[] | undefined {
  const tags: string[] = [];
  if (purchase.projectId) {
    tags.push(`项目:${purchase.projectId}`);
  }
  tags.push('来源:采购');
  return tags.length ? tags : undefined;
}

function resolveSaleAmount(movement: InventoryMovement, item?: InventoryItem): number {
  if (typeof movement.amount === 'number' && Number.isFinite(movement.amount)) {
    return Math.max(0, Number(movement.amount.toFixed(2)));
  }
  const quantity = Number.isFinite(movement.quantity) ? movement.quantity : 0;
  if (quantity <= 0) {
    return 0;
  }
  const unitPriceCandidates = [movement.unitCost, item?.salePrice, item?.unitPrice].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  );
  const unitPrice = unitPriceCandidates.length ? unitPriceCandidates[0] : 0;
  if (unitPrice <= 0) {
    return 0;
  }
  return Math.max(0, Number((unitPrice * quantity).toFixed(2)));
}

function buildSaleName(movement: InventoryMovement, item?: InventoryItem): string {
  const label = item?.name?.trim() || movement.itemId;
  return `销售收入 - ${label}`;
}

function buildSaleDescription(
  movement: InventoryMovement,
  item?: InventoryItem,
  warehouse?: Warehouse | null
): string {
  const segments: string[] = [];
  if (movement.clientName) {
    segments.push(`客户：${movement.clientName}`);
  }
  if (movement.clientContact) {
    segments.push(`联系人：${movement.clientContact}`);
  }
  if (warehouse?.name) {
    segments.push(`仓库：${warehouse.name}`);
  }
  if (item?.sku) {
    segments.push(`SKU：${item.sku}`);
  }
  if (movement.notes?.trim()) {
    segments.push(movement.notes.trim());
  }
  if (segments.length) {
    return segments.join(' | ');
  }
  return `销售出库流水：${movement.id}`;
}

function buildSaleTags(
  movement: InventoryMovement,
  item?: InventoryItem,
  warehouse?: Warehouse | null
): string[] | undefined {
  const tags = new Set<string>();
  tags.add('来源:库存');
  if (warehouse?.name) {
    tags.add(`仓库:${warehouse.name}`);
  }
  if (item?.sku) {
    tags.add(`SKU:${item.sku}`);
  }
  if (movement.clientName) {
    tags.add(`客户:${movement.clientName}`);
  }
  return tags.size ? Array.from(tags) : undefined;
}

function buildSaleMetadata(
  movement: InventoryMovement,
  item?: InventoryItem,
  warehouse?: Warehouse | null
): FinanceRecordMetadata {
  return {
    inventoryMovementId: movement.id,
    item: {
      id: movement.itemId,
      name: item?.name,
      sku: item?.sku,
      unit: item?.unit,
    },
    warehouse: {
      id: movement.warehouseId,
      name: warehouse?.name,
    },
    client: {
      id: movement.clientId,
      type: movement.clientType,
      name: movement.clientName,
      contact: movement.clientContact,
      phone: movement.clientPhone,
      address: movement.clientAddress,
    },
    relatedOrderId: movement.relatedOrderId,
    attributes: movement.attributes,
    notes: movement.notes,
  } satisfies FinanceRecordMetadata;
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
  } catch (error) {
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

export async function createPurchaseExpense(purchase: PurchaseRecord, operatorId: string): Promise<FinanceRecord> {
  const basePayload = {
    name: `采购支出 - ${purchase.itemName}`,
    type: TransactionType.EXPENSE,
    category: PURCHASE_EXPENSE_CATEGORY,
    date: toIsoDateString(purchase.paidAt ?? purchase.purchaseDate),
    contractAmount: purchase.totalAmount,
    fee: purchase.feeAmount ?? 0,
    quantity: purchase.quantity,
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
    supplierId: purchase.supplierId ?? null,
    projectId: purchase.projectId ?? undefined,
    metadata: buildPurchaseMetadata(purchase),
  } satisfies Omit<FinanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'totalAmount'>;

  const existing = await findRecordByPurchaseId(purchase.id);
  if (existing) {
    const updated = await updateRecord(existing.id, basePayload);
    if (!updated) {
      throw new Error('FAILED_TO_UPDATE_FINANCE_RECORD');
    }
    return updated;
  }

  return createRecord(basePayload);
}

export async function createSaleIncome(
  movement: InventoryMovement,
  operatorId: string
): Promise<FinanceRecord> {
  if (movement.direction !== 'outbound' || movement.type !== 'sale') {
    throw new Error('SALE_AUTOMATION_REQUIRES_SALE_MOVEMENT');
  }

  const [item, warehouse] = await Promise.all([
    getInventoryItem(movement.itemId),
    getWarehouse(movement.warehouseId),
  ]);

  const contractAmount = resolveSaleAmount(movement, item ?? undefined);
  const basePayload = {
    name: buildSaleName(movement, item ?? undefined),
    type: TransactionType.INCOME,
    category: SALE_INCOME_CATEGORY,
    date: toIsoDateString(movement.occurredAt),
    contractAmount,
    fee: 0,
    quantity: movement.quantity,
    paymentType: PaymentType.FULL_PAYMENT,
    paymentChannel: undefined,
    payer: movement.clientName ?? undefined,
    transactionNo: movement.relatedOrderId ?? undefined,
    invoice: undefined,
    description: buildSaleDescription(movement, item ?? undefined, warehouse),
    tags: buildSaleTags(movement, item ?? undefined, warehouse),
    createdBy: operatorId,
    sourceType: 'inventory' as const,
    status: 'cleared' as const,
    purchaseId: undefined,
    projectId: undefined,
    inventoryMovementId: movement.id,
    metadata: buildSaleMetadata(movement, item ?? undefined, warehouse),
  } satisfies Omit<FinanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'totalAmount'>;

  const existing = await findRecordByInventoryMovementId(movement.id);
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
