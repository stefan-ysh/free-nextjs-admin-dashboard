import { NextResponse } from 'next/server';
import type { QueryError } from 'mysql2';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import {
  approvePurchase,
  findPurchaseById,
  getPurchaseDetail,
  getPurchaseLogs,
  rejectPurchase,
  duplicatePurchase,
  submitPurchase,
  submitReimbursement,
  transferPurchaseApprover,
  withdrawPurchase,
} from '@/lib/db/purchases';
import { checkPermission, Permissions } from '@/lib/permissions';
import { mapPurchaseValidationError } from '@/lib/purchases/error-messages';
import { getWorkflowActionBlockedMessage, isWorkflowActionStatusAllowed } from '@/lib/purchases/workflow-rules';
import { isReimbursementV2Enabled } from '@/lib/features/gates';
import { isAdmin, UserRole } from '@/types/user';
import { getEmployeeById } from '@/lib/hr/employees';
import { ensureDepartmentBudgetWithinLimit } from '@/lib/purchases/budget-guard';
import { notifyPurchaseEvent } from '@/lib/notify';

const financeErrorMessages: Record<string, string> = {
  INVALID_DATE: '生成财务记录失败：日期格式不正确，请联系管理员处理',
  FAILED_TO_CREATE_FINANCE_RECORD: '生成财务记录失败，请稍后重试或联系管理员',
  FAILED_TO_UPDATE_FINANCE_RECORD: '更新财务记录失败，请稍后重试或联系管理员',
  FILE_TOO_LARGE: '财务附件超出大小限制，请压缩后再上传',
  UNSUPPORTED_FILE_TYPE: '财务附件类型不受支持，请上传常见图片或 PDF',
};

export const PURCHASE_WORKFLOW_ACTIONS = [
  'submit',
  'approve',
  'reject',
  'pay',
  'submit_reimbursement',
  'withdraw',
  'logs',
  'transfer',
  'duplicate',
  'issue',
  'resolve_issue',
] as const;
export type PurchaseWorkflowAction = (typeof PURCHASE_WORKFLOW_ACTIONS)[number];

type WorkflowOptions = {
  reason?: string;
  amount?: unknown;
  note?: unknown;
  comment?: string;
  toApproverId?: string;
};

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function flowRoleForbiddenResponse() {
  return NextResponse.json({ success: false, error: '超级管理员不参与审批/打款流程' }, { status: 403 });
}

function financeOrgForbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权处理该组织采购单' }, { status: 403 });
}

function notFoundResponse() {
  return NextResponse.json({ success: false, error: '未找到' }, { status: 404 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function mapFinanceMysqlError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const mysqlError = error as QueryError;
  if (!mysqlError.code) return null;
  switch (mysqlError.code) {
    case 'ER_DATA_TOO_LONG':
      return '生成财务记录失败：字段内容过长，请精简备注或项目名称';
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
      return '生成财务记录失败：金额或日期格式不正确，请检查采购数据';
    default:
      return null;
  }
}

async function respondWithDetail(purchaseId: string) {
  const detail = await getPurchaseDetail(purchaseId);
  if (!detail) return notFoundResponse();
  return NextResponse.json({ success: true, data: detail });
}

async function notifySafely(
  event:
    | 'purchase_submitted'
    | 'purchase_approved'
    | 'purchase_rejected'
    | 'purchase_transferred'
    | 'reimbursement_submitted'
    | 'purchase_paid'
    | 'payment_issue_marked'
    | 'payment_issue_resolved',
  purchaseId: string
) {
  try {
    const detail = await getPurchaseDetail(purchaseId);
    if (!detail) return;
    await notifyPurchaseEvent(event, detail);
  } catch (error) {
    console.warn(`短信通知发送失败: ${event}`, error);
  }
}

export function isPurchaseWorkflowAction(value: string | null | undefined): value is PurchaseWorkflowAction {
  return value != null && PURCHASE_WORKFLOW_ACTIONS.includes(value as PurchaseWorkflowAction);
}

export async function handlePurchaseWorkflowAction(
  action: PurchaseWorkflowAction,
  params: Promise<{ id: string }>,
  options: WorkflowOptions = {}
) {
  try {
    const { id } = await params;
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    if (permissionUser.primaryRole === UserRole.SUPER_ADMIN && action !== 'logs') {
      return flowRoleForbiddenResponse();
    }
    const purchase = await findPurchaseById(id);
    if (!purchase) return notFoundResponse();

    switch (action) {
      case 'submit': {
        if (context.user.id !== purchase.createdBy) return forbiddenResponse();
        if (!isWorkflowActionStatusAllowed('submit', purchase)) {
          return badRequestResponse(getWorkflowActionBlockedMessage('submit'));
        }
        await ensureDepartmentBudgetWithinLimit({
          purchaserId: purchase.purchaserId,
          purchaseDate: purchase.purchaseDate,
          totalAmount: Number(purchase.totalAmount) + Number(purchase.feeAmount ?? 0),
          actor: permissionUser,
        });
        await submitPurchase(id, context.user.id);
        await notifySafely('purchase_submitted', id);
        return respondWithDetail(id);
      }
      case 'approve': {
        if (permissionUser.primaryRole === UserRole.SUPER_ADMIN) return flowRoleForbiddenResponse();
        const perm = await checkPermission(permissionUser, Permissions.PURCHASE_APPROVE);
        if (!perm.allowed) return forbiddenResponse();
        if (!isWorkflowActionStatusAllowed('approve', purchase)) {
          return badRequestResponse(getWorkflowActionBlockedMessage('approve'));
        }
        if (purchase.pendingApproverId && purchase.pendingApproverId !== context.user.id && !isAdmin(permissionUser)) {
          return forbiddenResponse();
        }
        const comment = options.comment?.trim();
        // Hardcoded: removed dynamic node checks
        const updated = await approvePurchase(id, context.user.id, comment);
        if (updated.status === 'pending_approval') {
          await notifySafely('purchase_submitted', id);
        } else if (updated.status === 'approved' || updated.status === 'pending_inbound' || updated.status === 'paid') {
          await notifySafely('purchase_approved', id);
        }
        return respondWithDetail(id);
      }
      case 'reject': {
        if (permissionUser.primaryRole === UserRole.SUPER_ADMIN) return flowRoleForbiddenResponse();
        const perm = await checkPermission(permissionUser, Permissions.PURCHASE_REJECT);
        if (!perm.allowed) return forbiddenResponse();
        if (!isWorkflowActionStatusAllowed('reject', purchase)) {
          return badRequestResponse(getWorkflowActionBlockedMessage('reject'));
        }
        if (purchase.pendingApproverId && purchase.pendingApproverId !== context.user.id && !isAdmin(permissionUser)) {
          return forbiddenResponse();
        }
        const reason = options.reason?.trim();
        if (!reason) return badRequestResponse('驳回原因不能为空');
        await rejectPurchase(id, context.user.id, reason);
        await notifySafely('purchase_rejected', id);
        return respondWithDetail(id);
      }
      case 'transfer': {
        if (permissionUser.primaryRole === UserRole.SUPER_ADMIN) return flowRoleForbiddenResponse();
        const perm = await checkPermission(permissionUser, Permissions.PURCHASE_APPROVE);
        if (!perm.allowed) return forbiddenResponse();
        if (!isWorkflowActionStatusAllowed('transfer', purchase)) {
          return badRequestResponse(getWorkflowActionBlockedMessage('transfer'));
        }
        if (purchase.pendingApproverId && purchase.pendingApproverId !== context.user.id && !isAdmin(permissionUser)) {
          return forbiddenResponse();
        }
        const toApproverId = typeof options.toApproverId === 'string' ? options.toApproverId.trim() : '';
        const comment = options.comment?.trim();
        if (!toApproverId) return badRequestResponse('请选择转审对象');
        if (toApproverId === context.user.id) return badRequestResponse('不能转审给自己');
        if (!comment) return badRequestResponse('转审说明不能为空');
        const approver = await getEmployeeById(toApproverId);
        if (!approver) return badRequestResponse('转审对象不存在');
        const approverRole = approver.userPrimaryRole;
        const APPROVAL_ROLES: readonly string[] = Permissions.PURCHASE_APPROVE.anyRoles ?? [];
        const hasApprovalRole = !!approverRole && APPROVAL_ROLES.includes(approverRole as UserRole);
        if (!hasApprovalRole) return badRequestResponse('该用户没有审批权限，无法作为转审对象');
        await transferPurchaseApprover(id, context.user.id, toApproverId, comment);
        await notifySafely('purchase_transferred', id);
        return respondWithDetail(id);
      }
      case 'pay': {
        return badRequestResponse('采购流程不包含独立打款节点');
      }
      case 'submit_reimbursement': {
        if (isReimbursementV2Enabled()) {
          return badRequestResponse('当前已启用独立报销，请前往“报销中心”发起报销申请');
        }
        const isApplicant = context.user.id === purchase.purchaserId || context.user.id === purchase.createdBy;
        if (!isApplicant) return forbiddenResponse();
        if (!isWorkflowActionStatusAllowed('submit_reimbursement', purchase)) {
          return badRequestResponse(getWorkflowActionBlockedMessage('submit_reimbursement'));
        }
        await submitReimbursement(id, context.user.id);
        await notifySafely('reimbursement_submitted', id);
        return respondWithDetail(id);
      }
      case 'issue': {
        return badRequestResponse('采购流程不包含付款异常处理节点');
      }
      case 'resolve_issue': {
        return badRequestResponse('采购流程不包含付款异常处理节点');
      }
      case 'withdraw': {
        if (context.user.id !== purchase.createdBy) return forbiddenResponse();
        if (!isWorkflowActionStatusAllowed('withdraw', purchase)) {
          return badRequestResponse(getWorkflowActionBlockedMessage('withdraw'));
        }
        const reason = options.reason?.trim();
        if (!reason) return badRequestResponse('撤回原因不能为空');
        await withdrawPurchase(id, context.user.id, reason);
        return respondWithDetail(id);
      }
      case 'duplicate': {
        const canCreate = await checkPermission(permissionUser, Permissions.PURCHASE_CREATE);
        if (!canCreate.allowed) return forbiddenResponse();
        const canViewAll = await checkPermission(permissionUser, Permissions.PURCHASE_VIEW_ALL);
        const isOwner = context.user.id === purchase.createdBy;
        if (!isOwner && !canViewAll.allowed && !isAdmin(permissionUser)) return forbiddenResponse();
        const duplicated = await duplicatePurchase(id, context.user.id);
        const detail = await getPurchaseDetail(duplicated.id);
        if (!detail) return notFoundResponse();
        return NextResponse.json({ success: true, data: detail });
      }
      case 'logs': {
        const viewAll = await checkPermission(permissionUser, Permissions.PURCHASE_VIEW_ALL);
        if (!viewAll.allowed && context.user.id !== purchase.createdBy) return forbiddenResponse();
        const logs = await getPurchaseLogs(id);
        return NextResponse.json({ success: true, data: logs });
      }
      default:
        return badRequestResponse('未知操作');
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
      if (error.message === 'BUDGET_EXCEEDED') return badRequestResponse('超出部门预算，无法提交采购申请');

      const purchaseFriendly = mapPurchaseValidationError(error);
      if (purchaseFriendly) return badRequestResponse(purchaseFriendly);
      const friendly = financeErrorMessages[error.message];
      if (friendly) return badRequestResponse(friendly);
      const mysqlFriendly = mapFinanceMysqlError(error);
      if (mysqlFriendly) return badRequestResponse(mysqlFriendly);
    }
    const mysqlFriendly = mapFinanceMysqlError(error);
    if (mysqlFriendly) return badRequestResponse(mysqlFriendly);
    const fallbackPurchaseFriendly = mapPurchaseValidationError(error);
    if (fallbackPurchaseFriendly) return badRequestResponse(fallbackPurchaseFriendly);
    console.error('采购操作失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
