import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import {
  deleteReimbursement,
  getReimbursementById,
  getReimbursementLogs,
  updateReimbursement,
} from '@/lib/db/reimbursements';
import { mapReimbursementError } from '@/lib/reimbursements/error-messages';
import type { UpdateReimbursementInput } from '@/types/reimbursement';
import { UserRole } from '@/types/user';

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

function canHandleFinanceByOrg(role: UserRole, orgType: 'school' | 'company'): boolean {
  if (role === UserRole.SUPER_ADMIN) return true;
  if (role === UserRole.FINANCE) return true;
  if (role === UserRole.FINANCE_SCHOOL) return orgType === 'school';
  if (role === UserRole.FINANCE_COMPANY) return orgType === 'company';
  return false;
}

function canReadRecord(
  userId: string,
  role: UserRole,
  record: Awaited<ReturnType<typeof getReimbursementById>>,
  canViewAll: boolean
) {
  if (!record) return false;
  if (canViewAll) return true;
  if (record.applicantId === userId || record.createdBy === userId) return true;
  if (record.pendingApproverId === userId) return true;
  if (record.status === 'approved' && canHandleFinanceByOrg(role, record.organizationType)) return true;
  if (record.status === 'paid' && canHandleFinanceByOrg(role, record.organizationType)) return true;
  return false;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const canViewAll = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_VIEW_ALL);
    const record = await getReimbursementById(id);
    if (!record) return notFoundResponse();
    if (!canReadRecord(permissionUser.id, permissionUser.primaryRole, record, canViewAll.allowed)) {
      return forbiddenResponse();
    }

    const logs = await getReimbursementLogs(id);
    return NextResponse.json({ success: true, data: { ...record, logs } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
    console.error('获取报销详情失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const canUpdate = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_UPDATE);
    if (!canUpdate.allowed) return forbiddenResponse();

    const existing = await getReimbursementById(id);
    if (!existing) return notFoundResponse();
    if (existing.createdBy !== permissionUser.id && existing.applicantId !== permissionUser.id) {
      return forbiddenResponse();
    }

    const rawBody: unknown = await request.json();
    if (!rawBody || typeof rawBody !== 'object') return badRequestResponse('请求体格式错误');
    const updated = await updateReimbursement(id, rawBody as UpdateReimbursementInput);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
    const message = mapReimbursementError(error);
    if (message) return badRequestResponse(message);
    console.error('更新报销失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const existing = await getReimbursementById(id);
    if (!existing) return notFoundResponse();
    if (existing.createdBy !== permissionUser.id && existing.applicantId !== permissionUser.id) {
      return forbiddenResponse();
    }
    if (!(existing.status === 'draft' || existing.status === 'rejected')) {
      return badRequestResponse('当前状态不允许删除');
    }
    await deleteReimbursement(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
    console.error('删除报销失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
