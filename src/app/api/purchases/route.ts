import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { listPurchases, createPurchase } from '@/lib/db/purchases';
import { checkPermission, Permissions } from '@/lib/permissions';
import type {
  ListPurchasesParams,
  PurchaseStatus,
  PurchaseChannel,
  PaymentMethod,
} from '@/types/purchase';
import type { UserProfile } from '@/types/user';

const PURCHASE_STATUSES: PurchaseStatus[] = ['draft', 'pending_approval', 'approved', 'rejected', 'paid', 'cancelled'];
const PURCHASE_CHANNELS: PurchaseChannel[] = ['online', 'offline'];
const PAYMENT_METHODS: PaymentMethod[] = ['wechat', 'alipay', 'bank_transfer', 'corporate_transfer', 'cash'];
const SORTABLE_FIELDS: NonNullable<ListPurchasesParams['sortBy']>[] = ['createdAt', 'updatedAt', 'purchaseDate', 'totalAmount', 'status'];
const SORT_ORDERS: NonNullable<ListPurchasesParams['sortOrder']>[] = ['asc', 'desc'];

function parseStatus(value: string | null): ListPurchasesParams['status'] {
  if (!value) return undefined;
  if (value === 'all') return 'all';
  return PURCHASE_STATUSES.includes(value as PurchaseStatus) ? (value as PurchaseStatus) : undefined;
}

function parsePurchaseChannel(value: string | null): PurchaseChannel | undefined {
  if (!value) return undefined;
  return PURCHASE_CHANNELS.includes(value as PurchaseChannel) ? (value as PurchaseChannel) : undefined;
}

function parsePaymentMethod(value: string | null): PaymentMethod | undefined {
  if (!value) return undefined;
  return PAYMENT_METHODS.includes(value as PaymentMethod) ? (value as PaymentMethod) : undefined;
}

function parseSortBy(value: string | null): ListPurchasesParams['sortBy'] {
  if (!value) return undefined;
  return SORTABLE_FIELDS.includes(value as NonNullable<ListPurchasesParams['sortBy']>)
    ? (value as NonNullable<ListPurchasesParams['sortBy']>)
    : undefined;
}

function parseSortOrder(value: string | null): ListPurchasesParams['sortOrder'] {
  if (!value) return undefined;
  return SORT_ORDERS.includes(value as NonNullable<ListPurchasesParams['sortOrder']>)
    ? (value as NonNullable<ListPurchasesParams['sortOrder']>)
    : undefined;
}

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
    const userForPermission = context.user as unknown as UserProfile;
    const viewAll = await checkPermission(userForPermission, Permissions.PURCHASE_VIEW_ALL);

    const { searchParams } = new URL(request.url);
    const params: ListPurchasesParams = {};
    params.search = searchParams.get('search') ?? undefined;
  params.status = parseStatus(searchParams.get('status'));
    params.projectId = searchParams.get('projectId') ?? undefined;
  params.purchaseChannel = parsePurchaseChannel(searchParams.get('purchaseChannel'));
  params.paymentMethod = parsePaymentMethod(searchParams.get('paymentMethod'));
    params.startDate = searchParams.get('startDate') ?? undefined;
    params.endDate = searchParams.get('endDate') ?? undefined;

    const page = Number.parseInt(searchParams.get('page') ?? '', 10);
    const pageSize = Number.parseInt(searchParams.get('pageSize') ?? '', 10);
    params.page = Number.isNaN(page) ? undefined : page;
    params.pageSize = Number.isNaN(pageSize) ? undefined : pageSize;

  params.sortBy = parseSortBy(searchParams.get('sortBy'));
  params.sortOrder = parseSortOrder(searchParams.get('sortOrder'));

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
    const userForPermission = context.user as unknown as UserProfile;
    const perm = await checkPermission(userForPermission, Permissions.PURCHASE_CREATE);
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
