import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import {
  approveReimbursement,
  getReimbursementById,
  payReimbursement,
  rejectReimbursement,
  submitReimbursement,
  withdrawReimbursement,
} from '@/lib/db/reimbursements';
import { mapReimbursementError } from '@/lib/reimbursements/error-messages';
import { UserRole } from '@/types/user';

type WorkflowAction = 'submit' | 'approve' | 'reject' | 'pay' | 'withdraw';

type WorkflowBody = {
  action?: string;
  reason?: unknown;
  note?: unknown;
  comment?: unknown;
};

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

function isAction(value: string | null | undefined): value is WorkflowAction {
  return value === 'submit' || value === 'approve' || value === 'reject' || value === 'pay' || value === 'withdraw';
}

function canPayByOrg(role: UserRole, orgType: 'school' | 'company'): boolean {
  if (role === UserRole.FINANCE_SCHOOL) return orgType === 'school';
  if (role === UserRole.FINANCE_COMPANY) return orgType === 'company';
  return false;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') return badRequestResponse('请求体格式错误');
    const { action, reason, note, comment } = rawBody as WorkflowBody;
    if (!isAction(action)) return badRequestResponse('未知 action');

    const existing = await getReimbursementById(id);
    if (!existing) return notFoundResponse();

    if (action === 'submit') {
      const canSubmit = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_SUBMIT);
      if (!canSubmit.allowed) return forbiddenResponse();
      if (existing.applicantId !== permissionUser.id && existing.createdBy !== permissionUser.id) return forbiddenResponse();
      const updated = await submitReimbursement(id, permissionUser.id);
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'withdraw') {
      if (existing.applicantId !== permissionUser.id && existing.createdBy !== permissionUser.id) return forbiddenResponse();
      const updated = await withdrawReimbursement(
        id,
        permissionUser.id,
        typeof reason === 'string' ? reason : ''
      );
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'approve') {
      const canApprove = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_APPROVE);
      if (!canApprove.allowed) return forbiddenResponse();
      if (existing.pendingApproverId && existing.pendingApproverId !== permissionUser.id) return forbiddenResponse();
      const updated = await approveReimbursement(id, permissionUser.id, typeof comment === 'string' ? comment : null);
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'reject') {
      const canReject = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_REJECT);
      if (!canReject.allowed) return forbiddenResponse();
      if (existing.pendingApproverId && existing.pendingApproverId !== permissionUser.id) return forbiddenResponse();
      if (typeof reason !== 'string' || !reason.trim()) return badRequestResponse('驳回原因不能为空');
      const updated = await rejectReimbursement(id, permissionUser.id, reason.trim());
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'pay') {
      const canPay = await checkPermission(permissionUser, Permissions.REIMBURSEMENT_PAY);
      if (!canPay.allowed) return forbiddenResponse();
      if (!canPayByOrg(permissionUser.primaryRole, existing.organizationType)) return forbiddenResponse();
      const updated = await payReimbursement(id, permissionUser.id, typeof note === 'string' ? note : null);
      return NextResponse.json({ success: true, data: updated });
    }

    return badRequestResponse('未知 action');
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
    const message = mapReimbursementError(error);
    if (message) return badRequestResponse(message);
    console.error('报销流程操作失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

