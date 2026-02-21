import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import { listPurchases, listPendingApprovals } from '@/lib/db/purchases';
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

    const canPurchaseApprove = (await checkPermission(permissionUser, Permissions.PURCHASE_APPROVE)).allowed;
    const canPurchaseReject = (await checkPermission(permissionUser, Permissions.PURCHASE_REJECT)).allowed;
    const canPurchaseCreate = (await checkPermission(permissionUser, Permissions.PURCHASE_CREATE)).allowed;
    const canInboundAll = (await checkPermission(permissionUser, Permissions.INVENTORY_OPERATE_INBOUND)).allowed;
    const canInboundOwn = (await checkPermission(permissionUser, Permissions.INVENTORY_INBOUND_CREATE_OWN_PURCHASE_ONLY)).allowed;
    
    const canHandleApprovalTasks = canPurchaseApprove || canPurchaseReject;
    const canHandleInboundTasks = canInboundAll || canInboundOwn;

    const canReimbursementApprove = (await checkPermission(permissionUser, Permissions.REIMBURSEMENT_APPROVE)).allowed;
    const canReimbursementPay = (await checkPermission(permissionUser, Permissions.REIMBURSEMENT_PAY)).allowed;
    const canCreateReimbursement = (await checkPermission(permissionUser, Permissions.REIMBURSEMENT_CREATE)).allowed;
    const showReimbursementApprovalTasks = canReimbursementApprove && !canReimbursementPay;

    const currentUserId = context.user.id;
    const financeOrgType = resolveFinanceOrgByRole(permissionUser.primaryRole);

    const [approvalRes, inboundRes, rejectedRes, reimbursementApprovalRes, reimbursementPayRes, reimbursementRejectedRes] = await Promise.allSettled([
      // 1. Purchase Approvals
      canHandleApprovalTasks 
        ? listPendingApprovals({ pendingApproverId: currentUserId, includeUnassignedApprovals: false, page: 1, pageSize: 40 })
        : Promise.resolve({ items: [], total: 0 }),
      
      // 2. Purchase Inbound
      canHandleInboundTasks 
        ? listPurchases({
            status: 'pending_inbound',
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            page: 1,
            pageSize: 40,
            mineOrOrg: !canInboundAll && canInboundOwn ? { userId: currentUserId, orgType: 'school' } : undefined, // fallback for mineOrOrg logic, or just let DB do purchaserId
            purchaserId: !canInboundAll && canInboundOwn ? currentUserId : undefined
          })
        : Promise.resolve({ items: [], total: 0 }),

      // 3. Purchase Rejected
      canPurchaseCreate 
        ? listPurchases({
            status: 'rejected',
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            page: 1,
            pageSize: 40,
            purchaserId: currentUserId
          })
        : Promise.resolve({ items: [], total: 0 }),

      // 4. Reimbursement Approvals
      showReimbursementApprovalTasks
        ? listReimbursements({ scope: 'approval', currentUserId, financeOrgType, page: 1, pageSize: 40 })
        : Promise.resolve({ items: [], total: 0 }),

      // 5. Reimbursement Pay
      canReimbursementPay
        ? listReimbursements({ scope: 'pay', currentUserId, financeOrgType, page: 1, pageSize: 40 })
        : Promise.resolve({ items: [], total: 0 }),

      // 6. Reimbursement Rejected
      canCreateReimbursement
        ? listReimbursements({ scope: 'mine', status: 'rejected', currentUserId, financeOrgType, page: 1, pageSize: 40 })
        : Promise.resolve({ items: [], total: 0 }),
    ]);

    // Handle results safely
    const data = {
      purchaseApprovals: approvalRes.status === 'fulfilled' ? approvalRes.value.items : [],
      purchaseInbound: inboundRes.status === 'fulfilled' ? inboundRes.value.items : [],
      purchaseRejected: rejectedRes.status === 'fulfilled' ? rejectedRes.value.items : [],
      reimbursementApprovals: reimbursementApprovalRes.status === 'fulfilled' ? reimbursementApprovalRes.value.items : [],
      reimbursementPays: reimbursementPayRes.status === 'fulfilled' ? reimbursementPayRes.value.items : [],
      reimbursementRejected: reimbursementRejectedRes.status === 'fulfilled' ? reimbursementRejectedRes.value.items : [],
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    console.error('获取待办列表失败:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
