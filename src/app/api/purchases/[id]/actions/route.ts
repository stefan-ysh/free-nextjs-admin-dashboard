import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import {
  findPurchaseById,
  submitPurchase,
  approvePurchase,
  rejectPurchase,
  markAsPaid,
  withdrawPurchase,
  getPurchaseLogs,
} from '@/lib/db/purchases';
import { checkPermission, Permissions } from '@/lib/permissions';

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

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requireCurrentUser();
    const id = params.id;
    const purchase = await findPurchaseById(id);
    if (!purchase) return notFoundResponse();

    const body = await request.json();
    if (!body || typeof body !== 'object') return badRequestResponse('请求体格式错误');
    const action = body.action as string | undefined;
    if (!action) return badRequestResponse('缺少 action 字段');

    switch (action) {
      case 'submit': {
        // owner only
        if (context.user.id !== purchase.createdBy) return forbiddenResponse();
        const res = await submitPurchase(id, context.user.id);
        return NextResponse.json({ success: true, data: res });
      }
      case 'approve': {
        const perm = await checkPermission(context.user as any, Permissions.PURCHASE_APPROVE);
        if (!perm.allowed) return forbiddenResponse();
        const res = await approvePurchase(id, context.user.id);
        return NextResponse.json({ success: true, data: res });
      }
      case 'reject': {
        const perm = await checkPermission(context.user as any, Permissions.PURCHASE_REJECT);
        if (!perm.allowed) return forbiddenResponse();
        const reason = typeof body.reason === 'string' ? body.reason : '';
        const res = await rejectPurchase(id, context.user.id, reason);
        return NextResponse.json({ success: true, data: res });
      }
      case 'pay': {
        const perm = await checkPermission(context.user as any, Permissions.PURCHASE_PAY);
        if (!perm.allowed) return forbiddenResponse();
        const res = await markAsPaid(id, context.user.id);
        return NextResponse.json({ success: true, data: res });
      }
      case 'withdraw': {
        // owner only
        if (context.user.id !== purchase.createdBy) return forbiddenResponse();
        const res = await withdrawPurchase(id, context.user.id);
        return NextResponse.json({ success: true, data: res });
      }
      case 'logs': {
        const viewAll = await checkPermission(context.user as any, Permissions.PURCHASE_VIEW_ALL);
        if (!viewAll.allowed && context.user.id !== purchase.createdBy) return forbiddenResponse();
        const logs = await getPurchaseLogs(id);
        return NextResponse.json({ success: true, data: logs });
      }
      default:
        return badRequestResponse('未知 action');
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
      if (error.message.startsWith('NOT_') || error.message.startsWith('PURCHASE_')) return badRequestResponse(error.message);
    }
    console.error('采购操作失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
