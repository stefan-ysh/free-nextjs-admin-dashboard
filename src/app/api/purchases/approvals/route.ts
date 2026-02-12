import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listPendingApprovals } from '@/lib/db/purchases';
import { checkPermission, Permissions } from '@/lib/permissions';
import { UserRole, hasRole } from '@/types/user';

import { parsePurchaseListParams } from '../query-utils';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);

    const [canApprove, canReject, canPay] = await Promise.all([
      checkPermission(permissionUser, Permissions.PURCHASE_APPROVE),
      checkPermission(permissionUser, Permissions.PURCHASE_REJECT),
      checkPermission(permissionUser, Permissions.PURCHASE_PAY),
    ]);

    if (!canApprove.allowed && !canReject.allowed && !canPay.allowed) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const params = parsePurchaseListParams(searchParams);

    // Determine finance organization scope
    // If user is FINANCE_SCHOOL, they only see 'school' org type items (unless assigned explicitly)
    // If user is FINANCE_COMPANY, they only see 'company' org type items
    // If user is generic FINANCE or ADMIN, they see all (financeOrgType undefined)
    let financeOrgType: 'school' | 'company' | undefined;
    
    // Check specific roles first. If a user has multiple, we might need a hierarchy or strict separation.
    // For now, assume exclusive or priority: School > Company > Generic (if mixed, might see all? User implies separation)
    // Actually, if a user has BOTH, they should probably see BOTH. But the request implies separation.
    // Let's implement: if specific role exists AND NOT generic admin/finance, restrict it.
    // Or just: if has FINANCE_SCHOOL, add 'school'.
    // NOTE: The request says "if choose school, route to school finance". 
    // It implies we just need to filter visibility.
    
    const isGenericFinance = hasRole(permissionUser, UserRole.FINANCE);
    const isSchoolFinance = hasRole(permissionUser, UserRole.FINANCE_SCHOOL);
    const isCompanyFinance = hasRole(permissionUser, UserRole.FINANCE_COMPANY);
    const isSuperOrAdmin = hasRole(permissionUser, UserRole.SUPER_ADMIN) || hasRole(permissionUser, UserRole.ADMIN);

    if (!isSuperOrAdmin && !isGenericFinance) {
        if (isSchoolFinance && !isCompanyFinance) {
            financeOrgType = 'school';
        } else if (isCompanyFinance && !isSchoolFinance) {
            financeOrgType = 'company';
        }
        // If has both, or neither (but allowed), we default to undefined (see all/none dependent on other logic)
        // If has both, they effectively see all 'finance' items anyway, so undefined is fine (logic: see all unassigned)
    }

    const data = await listPendingApprovals({
      ...params,
      // Enforce current user filtering even for admins to ensure "Todo" only shows their specific tasks
      pendingApproverId: context.user.id,
      includeUnassignedApprovals: true,
      financeOrgType,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('加载采购审批列表失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
