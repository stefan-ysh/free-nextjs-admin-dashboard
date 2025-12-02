import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { deleteSupplier, getSupplierById, updateSupplier } from '@/lib/db/suppliers';
import { checkPermission, Permissions } from '@/lib/permissions';
import { formatSupplierError } from '../error-map';
import { parseSupplierPayload } from '../validators';

function unauthorized() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ success: false, error: '无权访问该功能' }, { status: 403 });
}

function notFound() {
  return NextResponse.json({ success: false, error: '供应商不存在' }, { status: 404 });
}

function badRequest(error: unknown) {
  return NextResponse.json(
    { success: false, error: formatSupplierError(error) },
    { status: 400 }
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.SUPPLIER_VIEW);
    if (!perm.allowed) return forbidden();

    const supplier = await getSupplierById(id);
    if (!supplier) return notFound();
    return NextResponse.json({ success: true, data: supplier });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorized();
    }
    console.error('获取供应商详情失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.SUPPLIER_MANAGE);
    if (!perm.allowed) return forbidden();

    const rawBody = await request.json();
    const payload = parseSupplierPayload(rawBody);
    const supplier = await updateSupplier(id, payload);
    return NextResponse.json({ success: true, data: supplier });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorized();
      if (error.message === 'SUPPLIER_NOT_FOUND') return notFound();
      if (
        error.message.startsWith('SUPPLIER_') ||
        error.message.startsWith('INVALID_') ||
        error.message.startsWith('FAILED_')
      ) {
        return badRequest(error);
      }
    }
    console.error('更新供应商失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.SUPPLIER_MANAGE);
    if (!perm.allowed) return forbidden();

    await deleteSupplier(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorized();
      if (error.message === 'SUPPLIER_NOT_FOUND') return notFound();
    }
    console.error('删除供应商失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
