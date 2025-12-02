import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { createSupplier, listSuppliers } from '@/lib/db/suppliers';
import { checkPermission, Permissions } from '@/lib/permissions';
import { formatSupplierError } from './error-map';
import { parseSupplierListParams, parseSupplierPayload } from './validators';

function unauthorized() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ success: false, error: '无权访问该功能' }, { status: 403 });
}

function badRequest(error: unknown) {
  return NextResponse.json(
    { success: false, error: formatSupplierError(error) },
    { status: 400 }
  );
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.SUPPLIER_VIEW);
    if (!perm.allowed) return forbidden();

    const { searchParams } = new URL(request.url);
    const params = parseSupplierListParams(searchParams);
    const result = await listSuppliers(params);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorized();
    }
    console.error('获取供应商列表失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.SUPPLIER_MANAGE);
    if (!perm.allowed) return forbidden();

    const rawBody = await request.json();
    const payload = parseSupplierPayload(rawBody);
    const supplier = await createSupplier(payload, context.user.id);
    return NextResponse.json({ success: true, data: supplier }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorized();
      if (error.message.startsWith('SUPPLIER_') || error.message.startsWith('INVALID_') || error.message.startsWith('FAILED_')) {
        return badRequest(error);
      }
    }
    console.error('创建供应商失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
