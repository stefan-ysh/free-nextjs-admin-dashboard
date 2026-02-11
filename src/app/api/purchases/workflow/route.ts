import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import {
  getPurchaseWorkflowConfig,
  listWorkflowApproverCandidates,
  upsertPurchaseWorkflowConfig,
} from '@/lib/db/purchase-workflow';
import { checkPermission, Permissions } from '@/lib/permissions';
import type { PurchaseWorkflowConfigInput } from '@/types/purchase-workflow';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

export async function GET() {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const permission = await checkPermission(permissionUser, Permissions.PURCHASE_APPROVE);
    if (!permission.allowed) return forbiddenResponse();

    const [config, approvers] = await Promise.all([
      getPurchaseWorkflowConfig(),
      listWorkflowApproverCandidates(),
    ]);

    return NextResponse.json({ success: true, data: { config, approvers } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('读取采购审批流程配置失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const permission = await checkPermission(permissionUser, Permissions.PURCHASE_APPROVE);
    if (!permission.allowed) return forbiddenResponse();

    const body = (await request.json()) as PurchaseWorkflowConfigInput;
    if (!body || typeof body !== 'object' || !Array.isArray(body.nodes)) {
      return NextResponse.json({ success: false, error: '请求参数不合法' }, { status: 400 });
    }

    const saved = await upsertPurchaseWorkflowConfig(body, context.user.id);
    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('保存采购审批流程配置失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
