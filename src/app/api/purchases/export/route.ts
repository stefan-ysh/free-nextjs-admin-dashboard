import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listPurchases } from '@/lib/db/purchases';
import { checkPermission, Permissions } from '@/lib/permissions';
import type { PurchaseRecord } from '@/types/purchase';
import { getPurchaseStatusText } from '@/types/purchase';
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

function formatCurrency(value: number): string {
  return value.toFixed(2);
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
    '支付通道',
    '代付人',
    '支付流水号',
    '申请人',
    '关联项目',
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

  const channelLabels: Record<PurchaseRecord['purchaseChannel'], string> = {
    online: '线上',
    offline: '线下',
  };

  const organizationLabels: Record<PurchaseRecord['organizationType'], string> = {
    school: '学校',
    company: '单位',
  };

  const paymentLabels: Record<PurchaseRecord['paymentMethod'], string> = {
    wechat: '微信',
    alipay: '支付宝',
    bank_transfer: '银行转账',
    corporate_transfer: '对公转账',
    cash: '现金',
  };

  const paymentTypeLabels: Record<PurchaseRecord['paymentType'], string> = {
    deposit: '定金',
    full: '全款',
    installment: '分期',
    balance: '尾款',
    other: '其他',
  };

  const invoiceTypeLabels: Record<PurchaseRecord['invoiceType'], string> = {
    special: '增值税专票',
    general: '普通发票',
    none: '无需发票',
  };

  const invoiceStatusLabels: Record<PurchaseRecord['invoiceStatus'], string> = {
    issued: '已开票',
    pending: '待开票',
    not_required: '无需开票',
  };

  const rows = records.map((purchase) => [
    purchase.purchaseNumber,
    getPurchaseStatusText(purchase.status),
    purchase.purchaseDate,
    organizationLabels[purchase.organizationType] ?? purchase.organizationType,
    purchase.itemName,
    purchase.specification ?? '',
    purchase.quantity,
    formatCurrency(purchase.unitPrice),
    formatCurrency(purchase.totalAmount),
    formatCurrency(purchase.feeAmount ?? 0),
    formatCurrency(purchase.totalAmount + (purchase.feeAmount ?? 0)),
    channelLabels[purchase.purchaseChannel],
    paymentLabels[purchase.paymentMethod],
    paymentTypeLabels[purchase.paymentType],
    purchase.paymentChannel ?? '',
    purchase.payerName ?? '',
    purchase.transactionNo ?? '',
    purchase.purchaserId,
    purchase.projectId ?? '',
    invoiceTypeLabels[purchase.invoiceType],
    invoiceStatusLabels[purchase.invoiceStatus],
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
    const viewAll = await checkPermission(permissionUser, Permissions.PURCHASE_VIEW_ALL);

    const { searchParams } = new URL(request.url);
    const params = parsePurchaseListParams(searchParams);

    if (!viewAll.allowed) {
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
