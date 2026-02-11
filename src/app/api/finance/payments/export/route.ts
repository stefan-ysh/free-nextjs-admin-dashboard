import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listPaymentQueue } from '@/lib/db/purchases';
import { checkPermission, Permissions } from '@/lib/permissions';
import { isPaymentQueueStatus } from '@/types/purchase';

const EXPORT_PAGE_SIZE = 200;
const MAX_EXPORT_ROWS = 5000;

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(records: Awaited<ReturnType<typeof listPaymentQueue>>['items']) {
  const paymentMethodLabels: Record<string, string> = {
    wechat: '微信',
    alipay: '支付宝',
    bank_transfer: '银行转账',
    corporate_transfer: '对公转账',
    cash: '现金',
  };

  const header = [
    '采购单号',
    '采购物品',
    '申请人',
    '部门',
    '工号',
    '供应商',
    '采购日期',
    '付款方式',
    '状态',
    '总金额',
    '已付款',
    '待付款',
    '付款异常',
    '异常说明',
  ];

  const rows = records.map((item) => [
    item.purchaseNumber,
    item.itemName,
    item.purchaserName ?? '',
    item.purchaserDepartment ?? '',
    item.purchaserEmployeeCode ?? '',
    item.supplierName ?? '',
    item.purchaseDate,
    paymentMethodLabels[item.paymentMethod] ?? item.paymentMethod,
    item.status,
    (item.totalAmount + (item.feeAmount ?? 0)).toFixed(2),
    item.paidAmount.toFixed(2),
    item.remainingAmount.toFixed(2),
    item.paymentIssueOpen ? '是' : '否',
    item.paymentIssueReason ?? '',
  ]);

  const csvLines = [header, ...rows].map((row) => row.map(escapeCsvValue).join(','));
  return `\ufeff${csvLines.join('\n')}`;
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);

    const [canPay, canViewFinance] = await Promise.all([
      checkPermission(permissionUser, Permissions.PURCHASE_PAY),
      checkPermission(permissionUser, Permissions.FINANCE_VIEW_ALL),
    ]);

    if (!canPay.allowed && !canViewFinance.allowed) {
      return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? undefined;
    const statusParam = searchParams.get('status');
    const idsParam = searchParams.get('ids');
    const ids = idsParam
      ? idsParam
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined;
    const status = isPaymentQueueStatus(statusParam) ? statusParam : 'all';

    const firstPage = await listPaymentQueue({ search, status, ids, page: 1, pageSize: EXPORT_PAGE_SIZE });
    if (firstPage.total > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        {
          success: false,
          error: `导出记录数超过 ${MAX_EXPORT_ROWS} 条，请缩小筛选范围`,
        },
        { status: 400 }
      );
    }

    const records = [...firstPage.items];
    let currentPage = 1;

    while (records.length < firstPage.total) {
      currentPage += 1;
      const nextPage = await listPaymentQueue({ search, status, ids, page: currentPage, pageSize: EXPORT_PAGE_SIZE });
      if (!nextPage.items.length) break;
      records.push(...nextPage.items);
    }

    const csv = buildCsv(records);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payments-${timestamp}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    console.error('导出付款队列失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
