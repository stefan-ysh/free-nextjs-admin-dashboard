import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import { listPurchases } from '@/lib/db/purchases';
import { listReimbursements } from '@/lib/db/reimbursements';
import { UserRole } from '@/types/user';

function resolveFinanceOrgByRole(role: UserRole): 'school' | 'company' | null {
  if (role === UserRole.FINANCE_SCHOOL) return 'school';
  if (role === UserRole.FINANCE_COMPANY) return 'company';
  return null;
}

export async function GET() {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);

    const canReimbursementPay = (await checkPermission(permissionUser, Permissions.REIMBURSEMENT_PAY)).allowed;
    const currentUserId = context.user.id;
    const financeOrgType = resolveFinanceOrgByRole(permissionUser.primaryRole);

    const [purchaseDoneRes, reimbursementDoneRes] = await Promise.allSettled([
      // 1. Purchase Done
      listPurchases({
        relatedUserId: currentUserId,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        page: 1,
        pageSize: 80,
      }),
      
      // 2. Reimbursement Done
      listReimbursements({
        scope: canReimbursementPay ? 'all' : 'mine',
        currentUserId,
        financeOrgType,
        page: 1,
        pageSize: 120,
      })
    ]);

    const data = {
      purchases: purchaseDoneRes.status === 'fulfilled' ? purchaseDoneRes.value.items : [],
      reimbursements: reimbursementDoneRes.status === 'fulfilled' ? reimbursementDoneRes.value.items : [],
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    console.error('获取已办列表失败:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
