import { NextResponse } from 'next/server';
import type { QueryError } from 'mysql2';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import {
  approvePurchase,
  findPurchaseById,
  getPurchaseDetail,
  getPurchaseLogs,
  markAsPaid,
  rejectPurchase,
  submitPurchase,
  withdrawPurchase,
} from '@/lib/db/purchases';
import { checkPermission, Permissions } from '@/lib/permissions';
import { mapPurchaseValidationError } from '@/lib/purchases/error-messages';

const financeErrorMessages: Record<string, string> = {
  INVALID_DATE: '生成财务记录失败：日期格式不正确，请联系管理员处理',
  FAILED_TO_CREATE_FINANCE_RECORD: '生成财务记录失败，请稍后重试或联系管理员',
  FAILED_TO_UPDATE_FINANCE_RECORD: '更新财务记录失败，请稍后重试或联系管理员',
  FILE_TOO_LARGE: '财务附件超出大小限制，请压缩后再上传',
  UNSUPPORTED_FILE_TYPE: '财务附件类型不受支持，请上传常见图片或 PDF',
};

export const PURCHASE_WORKFLOW_ACTIONS = ['submit', 'approve', 'reject', 'pay', 'withdraw', 'logs'] as const;
export type PurchaseWorkflowAction = (typeof PURCHASE_WORKFLOW_ACTIONS)[number];

type WorkflowOptions = {
  reason?: string;
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
    const purchase = await findPurchaseById(id);
    if (!purchase) return notFoundResponse();

    switch (action) {
      case 'submit': {
        if (context.user.id !== purchase.createdBy) return forbiddenResponse();
        await submitPurchase(id, context.user.id);
        return respondWithDetail(id);
      }
      case 'approve': {
        const perm = await checkPermission(permissionUser, Permissions.PURCHASE_APPROVE);
        if (!perm.allowed) return forbiddenResponse();
        await approvePurchase(id, context.user.id);
        return respondWithDetail(id);
      }
      case 'reject': {
        const perm = await checkPermission(permissionUser, Permissions.PURCHASE_REJECT);
        if (!perm.allowed) return forbiddenResponse();
        const reason = options.reason?.trim();
        if (!reason) return badRequestResponse('驳回原因不能为空');
        await rejectPurchase(id, context.user.id, reason);
        return respondWithDetail(id);
      }
      case 'pay': {
        const perm = await checkPermission(permissionUser, Permissions.PURCHASE_PAY);
        if (!perm.allowed) return forbiddenResponse();
        await markAsPaid(id, context.user.id);
        return respondWithDetail(id);
      }
      case 'withdraw': {
        if (context.user.id !== purchase.createdBy) return forbiddenResponse();
        await withdrawPurchase(id, context.user.id);
        return respondWithDetail(id);
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
