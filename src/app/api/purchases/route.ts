import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { listPurchases, createPurchase } from '@/lib/db/purchases';
import { checkPermission, Permissions } from '@/lib/permissions';
import { ListPurchasesParams } from '@/types/purchase';

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

    // allow full listing for users with viewAll permission, otherwise restrict to own purchases
  const viewAll = await checkPermission(context.user as any, Permissions.PURCHASE_VIEW_ALL);

    const { searchParams } = new URL(request.url);
    const params: ListPurchasesParams = {};
    params.search = searchParams.get('search') ?? undefined;
    params.status = (searchParams.get('status') as any) ?? undefined;
    params.projectId = searchParams.get('projectId') ?? undefined;
    params.purchaseChannel = (searchParams.get('purchaseChannel') as any) ?? undefined;
    params.paymentMethod = (searchParams.get('paymentMethod') as any) ?? undefined;
    params.startDate = searchParams.get('startDate') ?? undefined;
    params.endDate = searchParams.get('endDate') ?? undefined;

    const page = Number.parseInt(searchParams.get('page') ?? '', 10);
    const pageSize = Number.parseInt(searchParams.get('pageSize') ?? '', 10);
    params.page = Number.isNaN(page) ? undefined : page;
    params.pageSize = Number.isNaN(pageSize) ? undefined : pageSize;

    const sortBy = searchParams.get('sortBy') ?? undefined;
    const sortOrder = searchParams.get('sortOrder') ?? undefined;
    if (sortBy) params.sortBy = sortBy as any;
    if (sortOrder) params.sortOrder = sortOrder as any;

    // purchaserId handling: if caller is not allowed to view all, force to current user
    const purchaserIdParam = searchParams.get('purchaserId') ?? undefined;
    if (viewAll.allowed) {
      params.purchaserId = purchaserIdParam ?? undefined;
    } else {
      params.purchaserId = context.user.id;
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

    // check create permission (business-layer will do deeper checks)
  const perm = await checkPermission(context.user as any, Permissions.PURCHASE_CREATE);
    if (!perm.allowed) return forbiddenResponse();

    const body = await request.json();
    if (!body || typeof body !== 'object') return badRequestResponse('请求体格式错误');

    // minimal validation - DAO will assert more
    if (!body.purchaseDate || !body.itemName || typeof body.quantity !== 'number' || typeof body.unitPrice !== 'number') {
      return badRequestResponse('缺少必填字段');
    }

    const created = await createPurchase(body, context.user.id);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
      if (error.message.startsWith('PURCHASE_') || error.message.startsWith('INVALID_') || error.message.startsWith('MISSING_')) {
        return badRequestResponse(error.message);
      }
    }
    console.error('创建采购失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
