import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { getCategories, addCategory } from '@/lib/db/finance';
import { checkPermission, Permissions } from '@/lib/permissions';
import { TransactionType, FinanceApiResponse } from '@/types/finance';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

/**
 * GET - 获取分类列表
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.FINANCE_VIEW_ALL);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as TransactionType;

    if (!type || ![TransactionType.INCOME, TransactionType.EXPENSE].includes(type)) {
      return badRequestResponse('Invalid type parameter');
    }

    const categories = await getCategories(type);

    const response: FinanceApiResponse<string[]> = {
      success: true,
      data: categories,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

/**
 * POST - 添加新分类
 */
export async function POST(request: NextRequest) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.FINANCE_MANAGE);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const body = await request.json();

    if (!body.type || !body.category) {
      return badRequestResponse('Missing required fields');
    }

    if (![TransactionType.INCOME, TransactionType.EXPENSE].includes(body.type)) {
      return badRequestResponse('Invalid transaction type');
    }

    await addCategory(body.type, body.category);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('Error adding category:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add category' },
      { status: 500 }
    );
  }
}
