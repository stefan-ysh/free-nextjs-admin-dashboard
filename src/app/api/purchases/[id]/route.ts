import { requireCurrentUser } from '@/lib/auth/current-user';
import { deletePurchase, findPurchaseById, getPurchaseDetail, updatePurchase } from '@/lib/db/purchases';
import { canDeletePurchase, canEditPurchase, checkPermission, Permissions } from '@/lib/permissions';
import { NextResponse } from 'next/server';

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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requireCurrentUser();
    const id = params.id;
    
    // Check if requesting detailed view
    const url = new URL(request.url);
    const detailed = url.searchParams.get('detailed') === 'true';
    
    if (detailed) {
      const purchaseDetail = await getPurchaseDetail(id);
      if (!purchaseDetail) return notFoundResponse();

      const viewAll = await checkPermission(context.user as any, Permissions.PURCHASE_VIEW_ALL);
      if (!viewAll.allowed && context.user.id !== purchaseDetail.createdBy) {
        return forbiddenResponse();
      }

      return NextResponse.json({ success: true, data: purchaseDetail });
    }
    
    // Standard view (without joins)
    const purchase = await findPurchaseById(id);
    if (!purchase) return notFoundResponse();

    const viewAll = await checkPermission(context.user as any, Permissions.PURCHASE_VIEW_ALL);
    if (!viewAll.allowed && context.user.id !== purchase.createdBy) {
      return forbiddenResponse();
    }

    return NextResponse.json({ success: true, data: purchase });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
    console.error('获取采购详情失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requireCurrentUser();
    const id = params.id;
    const purchase = await findPurchaseById(id);
    if (!purchase) return notFoundResponse();

    // check editable
    if (!canEditPurchase(context.user as any, { createdBy: purchase.createdBy, status: purchase.status })) {
      return forbiddenResponse();
    }

    const body = await request.json();
    if (!body || typeof body !== 'object') return badRequestResponse('请求体格式错误');

    const updated = await updatePurchase(id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
      if (error.message === 'NOT_EDITABLE' || error.message.startsWith('INVALID_')) return badRequestResponse(error.message);
      if (error.message === 'PURCHASE_NOT_FOUND') return notFoundResponse();
    }
    console.error('更新采购失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requireCurrentUser();
    const id = params.id;
    const purchase = await findPurchaseById(id);
    if (!purchase) return notFoundResponse();

    if (!canDeletePurchase(context.user as any, { createdBy: purchase.createdBy, status: purchase.status })) {
      // admins might delete non-paid but permission check already in canDeletePurchase
      return forbiddenResponse();
    }

    await deletePurchase(id, context.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
      if (error.message === 'NOT_DELETABLE') return badRequestResponse(error.message);
      if (error.message === 'PURCHASE_NOT_FOUND') return notFoundResponse();
    }
    console.error('删除采购失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
