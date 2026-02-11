import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listPurchases, createPurchase } from '@/lib/db/purchases';
import { ensureDepartmentBudgetWithinLimit } from '@/lib/purchases/budget-guard';
import { checkPermission, Permissions } from '@/lib/permissions';
import { CreatePurchaseInput } from '@/types/purchase';
import { parsePurchaseListParams } from './query-utils';
import { mapPurchaseValidationError } from '@/lib/purchases/error-messages';

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

    // allow full listing for users with viewAll permission,
    // otherwise restrict to department scope (if available) or own purchases
    const [viewAll, viewDepartment] = await Promise.all([
      checkPermission(permissionUser, Permissions.PURCHASE_VIEW_ALL),
      checkPermission(permissionUser, Permissions.PURCHASE_VIEW_DEPARTMENT),
    ]);
    const { searchParams } = new URL(request.url);
    const params = parsePurchaseListParams(searchParams);

    if (!viewAll.allowed) {
      if (viewDepartment.allowed && permissionUser.department) {
        params.purchaserDepartment = permissionUser.department;
      } else {
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

    // check create permission (business-layer will do deeper checks)
    const perm = await checkPermission(permissionUser, Permissions.PURCHASE_CREATE);
    if (!perm.allowed) return forbiddenResponse();

    const rawBody: unknown = await request.json();
    if (!rawBody || typeof rawBody !== 'object') return badRequestResponse('请求体格式错误');
    const body = rawBody as CreatePurchaseInput;

    // minimal validation - DAO will assert more
    if (
      !body.purchaseDate ||
      !body.organizationType ||
      !body.itemName ||
      typeof body.quantity !== 'number' ||
      typeof body.unitPrice !== 'number' ||
      typeof body.paymentMethod !== 'string' ||
      typeof body.paymentType !== 'string'
    ) {
      return badRequestResponse('缺少必填字段');
    }

    const purchaserId = body.purchaserId ?? context.user.id;
    const totalAmount = Number(body.quantity) * Number(body.unitPrice) + Number(body.feeAmount ?? 0);
    await ensureDepartmentBudgetWithinLimit({
      purchaserId,
      purchaseDate: body.purchaseDate,
      totalAmount,
      actor: permissionUser,
    });

    const created = await createPurchase(body, context.user.id);
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
