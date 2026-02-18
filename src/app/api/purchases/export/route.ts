import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listPurchases } from '@/lib/db/purchases';
import {
  getPurchaseStatusText,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  PURCHASE_CHANNEL_LABELS,
  PURCHASE_ORGANIZATION_LABELS,
  type PurchaseRecord,
} from '@/types/purchase';
import { UserRole } from '@/types/user';
import { formatCurrency } from '@/lib/format';
import { parsePurchaseListParams } from '../query-utils';

const MAX_EXPORT_ROWS = 5000;
const EXPORT_PAGE_SIZE = 500;

function escapeCsvValue(value: unknown): string {
  if (value == null) return '';
  const stringValue = String(value);
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}



function buildCsv(records: PurchaseRecord[]): string {
  const header = [
    '采购单号',
    '状态',
    '采购日期',
    '采购组织',
    '物品名称',
    '规格/型号',
    '数量',
    '单价',
    '合同金额',
    '手续费',
    '总金额(含手续费)',
    '采购渠道',
    '付款方式',
    '款项类型',
    '申请人',
    '发票类型',
    '开票状态',
    '发票号码',
    '开票日期',
    '用途',
    '备注',
    '提交时间',
    '审批时间',
    '打款时间',
  ];



  const rows = records.map((purchase) => [
    purchase.purchaseNumber,
    getPurchaseStatusText(purchase.status),
    purchase.purchaseDate,
    PURCHASE_ORGANIZATION_LABELS[purchase.organizationType] ?? purchase.organizationType,
    purchase.itemName,
    purchase.specification ?? '',
    purchase.quantity,
    formatCurrency(purchase.unitPrice),
    formatCurrency(purchase.totalAmount),
    formatCurrency(purchase.feeAmount ?? 0),
    formatCurrency(purchase.totalAmount + (purchase.feeAmount ?? 0)),
    PURCHASE_CHANNEL_LABELS[purchase.purchaseChannel],
    PAYMENT_METHOD_LABELS[purchase.paymentMethod],
    PAYMENT_TYPE_LABELS[purchase.paymentType],
    purchase.purchaserId,
    INVOICE_TYPE_LABELS[purchase.invoiceType],
    INVOICE_STATUS_LABELS[purchase.invoiceStatus],
    purchase.invoiceNumber ?? '',
    purchase.invoiceIssueDate ?? '',
    purchase.purpose,
    purchase.notes ?? '',
    purchase.submittedAt ?? '',
    purchase.approvedAt ?? purchase.rejectedAt ?? '',
    purchase.paidAt ?? '',
  ]);

  const csvLines = [header, ...rows].map((row) => row.map(escapeCsvValue).join(','));
  // prepend BOM to improve Excel compatibility
  return `\ufeff${csvLines.join('\n')}`;
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const isSuperAdmin = permissionUser.primaryRole === UserRole.SUPER_ADMIN;

    const { searchParams } = new URL(request.url);
    const params = parsePurchaseListParams(searchParams);

    if (!isSuperAdmin) {
      params.purchaserId = context.user.id;
    }

    const baseParams = {
      ...params,
      page: 1,
      pageSize: EXPORT_PAGE_SIZE,
    };

    const firstPage = await listPurchases(baseParams);
    if (firstPage.total > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        {
          success: false,
          error: `导出记录数超过 ${MAX_EXPORT_ROWS} 条，请缩小筛选范围`,
        },
        { status: 400 }
      );
    }

    const records: PurchaseRecord[] = [...firstPage.items];
    let currentPage = 1;

    while (records.length < firstPage.total) {
      currentPage += 1;
      const nextPage = await listPurchases({ ...baseParams, page: currentPage });
      if (!nextPage.items.length) break;
      records.push(...nextPage.items);
    }

    const csv = buildCsv(records);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="purchases-${timestamp}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    console.error('导出采购列表失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
