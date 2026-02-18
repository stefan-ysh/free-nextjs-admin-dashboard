import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listReimbursements } from '@/lib/db/reimbursements';
import { checkPermission, Permissions } from '@/lib/permissions';
import { isReimbursementStatus, type ReimbursementStatus } from '@/types/reimbursement';
import { UserRole } from '@/types/user';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function parseNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeStatusParam(value: string | null): ReimbursementStatus | undefined {
  if (!value) return undefined;
  if (isReimbursementStatus(value)) return value;
  if (value === 'all') return undefined;
  if (value === 'pending' || value === 'processing') return 'pending_approval';
  if (value === 'paid') return 'paid';
  if (value === 'issue') return 'rejected';
  return undefined;
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);

    const canPay = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_PAY);

    if (!canPay.allowed) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? undefined;
    const status = normalizeStatusParam(searchParams.get('status'));
    const page = parseNumber(searchParams.get('page'), 1);
    const pageSize = parseNumber(searchParams.get('pageSize'), 50);
    const activeRole = permissionUser.primaryRole;
    const financeOrgType =
      activeRole === UserRole.FINANCE_SCHOOL
        ? 'school'
        : activeRole === UserRole.FINANCE_COMPANY
          ? 'company'
          : null;

    const data = await listReimbursements({
      scope: 'pay',
      currentUserId: permissionUser.id,
      financeOrgType,
      page,
      pageSize,
      search,
      status,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('加载付款队列失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
