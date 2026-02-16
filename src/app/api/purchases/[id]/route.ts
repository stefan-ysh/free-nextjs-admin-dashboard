import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { deletePurchase, findPurchaseById, getPurchaseDetail, updatePurchase } from '@/lib/db/purchases';
import { canDeletePurchase, canEditPurchase, checkPermission, Permissions } from '@/lib/permissions';
import { mapPurchaseValidationError } from '@/lib/purchases/error-messages';
import { NextResponse } from 'next/server';

import type { UpdatePurchaseInput } from '@/types/purchase';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function notFoundResponse() {
  return NextResponse.json({ success: false, error: '未找到' }, { status: 404 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const purchaseDetail = await getPurchaseDetail(id);
    if (!purchaseDetail) return notFoundResponse();

    const viewAll = await checkPermission(permissionUser, Permissions.PURCHASE_VIEW_ALL);
    if (!viewAll.allowed && context.user.id !== purchaseDetail.createdBy) {
      return forbiddenResponse();
    }

    return NextResponse.json({ success: true, data: purchaseDetail });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
    console.error('获取采购详情失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const purchase = await findPurchaseById(id);
    if (!purchase) return notFoundResponse();

    // check editable
    if (
      !canEditPurchase(permissionUser, {
        createdBy: purchase.createdBy,
        status: purchase.status,
        reimbursementStatus: purchase.reimbursementStatus,
      })
    ) {
      return forbiddenResponse();
    }

    const rawBody: unknown = await request.json();
    if (!rawBody || typeof rawBody !== 'object') return badRequestResponse('请求体格式错误');
    const body = rawBody as UpdatePurchaseInput;

    const updated = await updatePurchase(id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
      const friendly = mapPurchaseValidationError(error);
      if (friendly) return badRequestResponse(friendly);
      if (error.message === 'PURCHASE_NOT_FOUND') return notFoundResponse();
    }
    const fallbackFriendly = mapPurchaseValidationError(error);
    if (fallbackFriendly) return badRequestResponse(fallbackFriendly);
    console.error('更新采购失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const purchase = await findPurchaseById(id);
    if (!purchase) return notFoundResponse();

    if (!canDeletePurchase(permissionUser, { createdBy: purchase.createdBy, status: purchase.status })) {
      // admins might delete non-paid but permission check already in canDeletePurchase
      return forbiddenResponse();
    }

    await deletePurchase(id, context.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
      const friendly = mapPurchaseValidationError(error);
      if (friendly) return badRequestResponse(friendly);
      if (error.message === 'PURCHASE_NOT_FOUND') return notFoundResponse();
    }
    const fallbackFriendly = mapPurchaseValidationError(error);
    if (fallbackFriendly) return badRequestResponse(fallbackFriendly);
    console.error('删除采购失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
