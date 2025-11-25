import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { listClients, createClient } from '@/lib/db/clients';
import { checkPermission, Permissions } from '@/lib/permissions';
import { parseClientListParams, parseClientPayload } from './validators';

function unauthorized() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ success: false, error: '无权访问该功能' }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.CLIENT_VIEW);
    if (!perm.allowed) return forbidden();

    const { searchParams } = new URL(request.url);
    const params = parseClientListParams(searchParams);
    const result = await listClients(params);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorized();
    }
    console.error('获取客户列表失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.CLIENT_MANAGE);
    if (!perm.allowed) return forbidden();

    const rawBody = await request.json();
    const payload = parseClientPayload(rawBody);
    const created = await createClient(payload, context.user.id);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorized();
      if (error.message.startsWith('CLIENT_') || error.message.startsWith('INVALID_')) {
        return badRequest(error.message);
      }
    }
    console.error('创建客户失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
