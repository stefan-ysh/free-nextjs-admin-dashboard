import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { getClientById, updateClient, softDeleteClient } from '@/lib/db/clients';
import { checkPermission, Permissions } from '@/lib/permissions';
import { parsePartialClientPayload } from '../validators';

function unauthorized() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ success: false, error: '无权访问该功能' }, { status: 403 });
}

function notFound() {
  return NextResponse.json({ success: false, error: '客户不存在或已删除' }, { status: 404 });
}

function badRequest(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.CLIENT_VIEW);
    if (!perm.allowed) return forbidden();

    const client = await getClientById(id);
    if (!client) return notFound();
    return NextResponse.json({ success: true, data: client });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorized();
    }
    console.error('获取客户详情失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.CLIENT_MANAGE);
    if (!perm.allowed) return forbidden();

    const rawBody = await request.json();
    const partial = parsePartialClientPayload(rawBody);
    const updated = await updateClient(id, partial);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorized();
      if (error.message === 'CLIENT_NOT_FOUND') return notFound();
      if (error.message.startsWith('CLIENT_') || error.message.startsWith('INVALID_')) {
        return badRequest(error.message);
      }
    }
    console.error('更新客户失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.CLIENT_MANAGE);
    if (!perm.allowed) return forbidden();

    await softDeleteClient(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorized();
      if (error.message === 'CLIENT_NOT_FOUND') return notFound();
    }
    console.error('删除客户失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
