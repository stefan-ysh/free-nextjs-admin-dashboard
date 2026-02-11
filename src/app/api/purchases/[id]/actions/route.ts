import { NextResponse } from 'next/server';

import {
  handlePurchaseWorkflowAction,
  isPurchaseWorkflowAction,
} from '@/app/api/purchases/[id]/workflow-handler';

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

type WorkflowBody = {
  action?: string;
  reason?: unknown;
  amount?: unknown;
  note?: unknown;
  comment?: unknown;
  toApproverId?: unknown;
};

function normalizeReason(reason: unknown) {
  if (typeof reason !== 'string') return undefined;
  const trimmed = reason.trim();
  return trimmed ? trimmed : undefined;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rawBody: unknown = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object') return badRequestResponse('请求体格式错误');
  const { action, reason, amount, note, comment, toApproverId } = rawBody as WorkflowBody;
  if (!action) return badRequestResponse('缺少 action 字段');
  if (!isPurchaseWorkflowAction(action)) return badRequestResponse('未知 action');

  return handlePurchaseWorkflowAction(action, params, {
    reason: normalizeReason(reason),
    amount,
    note,
    comment: typeof comment === 'string' ? comment.trim() : undefined,
    toApproverId: typeof toApproverId === 'string' ? toApproverId.trim() : undefined,
  });
}
