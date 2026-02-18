import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listPurchases } from '@/lib/db/purchases';
import { checkPermission, Permissions } from '@/lib/permissions';
import { UserRole } from '@/types/user';

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);

    const canPay = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_PAY);
    if (!canPay.allowed) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 20;
    const search = searchParams.get('search') || '';

    let organizationType: 'school' | 'company' | undefined;
    if (permissionUser.primaryRole === UserRole.FINANCE_SCHOOL) {
      organizationType = 'school';
    } else if (permissionUser.primaryRole === UserRole.FINANCE_COMPANY) {
      organizationType = 'company';
    }

    const result = await listPurchases({
      page,
      pageSize,
      search,
      organizationType,
      statusList: ['approved', 'pending_inbound'],
      paymentStatus: 'unpaid',
      sortBy: 'updatedAt',
      sortOrder: 'asc',
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Failed to fetch purchase payments', error);
    return NextResponse.json({ success: false, error: '加载失败' }, { status: 500 });
  }
}
