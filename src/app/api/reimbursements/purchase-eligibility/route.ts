import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { checkPurchaseEligibilityForReimbursement } from '@/lib/db/reimbursements';

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    await requireCurrentUser();
    const { searchParams } = new URL(request.url);
    const purchaseId = searchParams.get('purchaseId')?.trim();
    const reimbursementId = searchParams.get('reimbursementId')?.trim() || null;
    if (!purchaseId) return badRequestResponse('缺少 purchaseId');

    const data = await checkPurchaseEligibilityForReimbursement(purchaseId, {
      excludeReimbursementId: reimbursementId,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return unauthorizedResponse();
    console.error('采购报销关联校验失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
