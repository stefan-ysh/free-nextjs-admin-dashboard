import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listPurchases, createPurchase } from '@/lib/db/purchases';
// import { ensureDepartmentBudgetWithinLimit } from '@/lib/purchases/budget-guard'; // Removed
import { checkPermission, Permissions } from '@/lib/permissions';
import { CreatePurchaseInput } from '@/types/purchase';
import { UserRole } from '@/types/user';
import { parsePurchaseListParams } from './query-utils';
import { mapPurchaseValidationError } from '@/lib/purchases/error-messages';
import { createPurchaseSchema } from '@/lib/validations/purchase';
import { logSystemAudit } from '@/lib/audit';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const isSuperAdmin = permissionUser.primaryRole === UserRole.SUPER_ADMIN;
    const isFinanceDirector = permissionUser.primaryRole === UserRole.FINANCE_DIRECTOR;
    const isFinanceSchool = permissionUser.primaryRole === UserRole.FINANCE_SCHOOL;
    const isFinanceCompany = permissionUser.primaryRole === UserRole.FINANCE_COMPANY;
    
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const params = parsePurchaseListParams(searchParams);
    
    params.currentUserId = context.user.id;

    if (!isSuperAdmin) {
      if (scope === 'workflow_done') {
        params.relatedUserId = context.user.id;
      } else if (scope === 'rejected_own') {
        // 财务人员或普通员工查看自己被驳回的采购，始终按用户ID过滤
        params.purchaserId = context.user.id;
        params.status = 'rejected';
      } else if (isFinanceDirector) {
        // 财务总监可查看所有组织类型的采购
      } else if (isFinanceSchool) {
        // 学校财务仅查看学校采购
        params.organizationType = 'school';
      } else if (isFinanceCompany) {
        // 单位财务仅查看单位采购
        params.organizationType = 'company';
      } else {
        // 普通员工只能查看自己的采购
        params.purchaserId = context.user.id;
      }
    }

    const result = await listPurchases(params);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('获取采购列表失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    if (permissionUser.primaryRole === UserRole.SUPER_ADMIN) return forbiddenResponse();

    // check create permission (business-layer will do deeper checks)
    const perm = await checkPermission(permissionUser, Permissions.PURCHASE_CREATE);
    if (!perm.allowed) return forbiddenResponse();

    const rawBody: unknown = await request.json();
    const result = createPurchaseSchema.safeParse(rawBody);

    if (!result.success) {
      return badRequestResponse(result.error.issues[0]?.message || '请求参数格式错误');
    }

    const body = result.data as CreatePurchaseInput;

    // const purchaserId = body.purchaserId ?? context.user.id; // Unused after removing budget check
    // const totalAmount = Number(body.quantity) * Number(body.unitPrice) + Number(body.feeAmount ?? 0);
    // User requested to remove budget check
    // await ensureDepartmentBudgetWithinLimit({ ... });

    const created = await createPurchase(body, context.user.id);
    
    await logSystemAudit({
      userId: context.user.id,
      userName: context.user.display_name ?? '未知用户',
      action: 'CREATE',
      entityType: 'PURCHASE',
      entityId: created.id,
      entityName: `${body.itemName} x ${body.quantity}`,
      newValues: body as unknown as Record<string, unknown>,
    });
    
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
      if (error.message === 'BUDGET_EXCEEDED') return badRequestResponse('超出部门预算，无法提交采购申请');
      const friendly = mapPurchaseValidationError(error);
      if (friendly) return badRequestResponse(friendly);
    }
    const fallbackFriendly = mapPurchaseValidationError(error);
    if (fallbackFriendly) return badRequestResponse(fallbackFriendly);
    console.error('创建采购失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
