import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listReimbursements } from '@/lib/db/reimbursements';
import { checkPermission, Permissions } from '@/lib/permissions';
import { isReimbursementStatus, type ReimbursementStatus } from '@/types/reimbursement';
import { UserRole } from '@/types/user';

const EXPORT_PAGE_SIZE = 200;
const MAX_EXPORT_ROWS = 5000;

function normalizeStatusParam(value: string | null): ReimbursementStatus | undefined {
  if (!value) return undefined;
  if (isReimbursementStatus(value)) return value;
  if (value === 'all') return undefined;
  if (value === 'pending' || value === 'processing') return 'pending_approval';
  if (value === 'paid') return 'paid';
  if (value === 'issue') return 'rejected';
  return undefined;
}

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(records: Awaited<ReturnType<typeof listReimbursements>>['items']) {
  const header = [
    '报销单号',
    '标题',
    '申请人',
    '组织',
    '发生日期',
    '来源',
    '分类',
    '状态',
    '金额',
    '关联采购单',
    '打款人',
    '打款备注',
  ];

  const rows = records.map((item) => [
    item.reimbursementNumber,
    item.title,
    item.applicantName ?? item.applicantId,
    item.organizationType === 'school' ? '学校' : '单位',
    item.occurredAt,
    item.sourceType === 'purchase' ? '关联采购' : '直接报销',
    String(item.category),
    item.status,
    item.amount.toFixed(2),
    item.sourcePurchaseNumber ?? '',
    item.paidByName ?? item.paidBy ?? '',
    item.paymentNote ?? '',
  ]);

  const csvLines = [header, ...rows].map((row) => row.map(escapeCsvValue).join(','));
  return `\ufeff${csvLines.join('\n')}`;
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);

    const canPay = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_PAY);

    if (!canPay.allowed) {
      return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? undefined;
    const status = normalizeStatusParam(searchParams.get('status'));
    const activeRole = permissionUser.primaryRole;
    const financeOrgType =
      activeRole === UserRole.FINANCE_SCHOOL
        ? 'school'
        : activeRole === UserRole.FINANCE_COMPANY
          ? 'company'
          : null;

    const firstPage = await listReimbursements({
      scope: 'pay',
      currentUserId: permissionUser.id,
      financeOrgType,
      search,
      status,
      page: 1,
      pageSize: EXPORT_PAGE_SIZE,
    });
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
      const nextPage = await listReimbursements({
        scope: 'pay',
        currentUserId: permissionUser.id,
        financeOrgType,
        search,
        status,
        page: currentPage,
        pageSize: EXPORT_PAGE_SIZE,
      });
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
