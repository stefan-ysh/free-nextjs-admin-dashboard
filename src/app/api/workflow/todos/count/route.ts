import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import { mysqlPool } from '@/lib/mysql';
import { RowDataPacket } from 'mysql2/promise';

export async function GET() {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);

    const canPurchaseApprove = (await checkPermission(permissionUser, Permissions.PURCHASE_APPROVE)).allowed;
    const canPurchaseCreate = (await checkPermission(permissionUser, Permissions.PURCHASE_CREATE)).allowed;
    const canInboundAll = (await checkPermission(permissionUser, Permissions.INVENTORY_OPERATE_INBOUND)).allowed;
    const canInboundOwn = (await checkPermission(permissionUser, Permissions.INVENTORY_INBOUND_CREATE_OWN_PURCHASE_ONLY)).allowed;
    const canInbound = canInboundAll || canInboundOwn;

    const canReimbursementApprove = (await checkPermission(permissionUser, Permissions.REIMBURSEMENT_APPROVE)).allowed;
    const canReimbursementPay = (await checkPermission(permissionUser, Permissions.REIMBURSEMENT_PAY)).allowed;
    const canCreateReimbursement = (await checkPermission(permissionUser, Permissions.REIMBURSEMENT_CREATE)).allowed;
    const showReimbursementApprovals = canReimbursementApprove && !canReimbursementPay;

    if (!canPurchaseApprove && !canPurchaseCreate && !canInbound && !showReimbursementApprovals && !canReimbursementPay && !canCreateReimbursement) {
      return NextResponse.json({ success: true, data: { total: 0, details: {} } });
    }

    const pool = mysqlPool();
    const currentUserId = context.user.id;
    const queries: Promise<{ name: string; count: number }>[] = [];

    if (canPurchaseApprove) {
      const q = pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM purchases WHERE status = "pending_approval" AND pending_approver_id = ?', [currentUserId])
        .then(([rows]) => ({ name: 'purchaseApprovals', count: Number(rows[0]?.count || 0) }));
      queries.push(q);
    }

    if (canInbound) {
      let qStr = 'SELECT COUNT(*) as count FROM purchases WHERE status = "pending_inbound"';
      const qParams: unknown[] = [];
      if (!canInboundAll && canInboundOwn) {
        qStr += ' AND purchaser_id = ?';
        qParams.push(currentUserId);
      }
      const q = pool.query<RowDataPacket[]>(qStr, qParams)
        .then(([rows]) => ({ name: 'purchaseInbound', count: Number(rows[0]?.count || 0) }));
      queries.push(q);
    }

    if (canPurchaseCreate) {
      const q = pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM purchases WHERE status = "rejected" AND (created_by = ? OR purchaser_id = ?)', [currentUserId, currentUserId])
        .then(([rows]) => ({ name: 'purchaseRejected', count: Number(rows[0]?.count || 0) }));
      queries.push(q);
    }

    if (showReimbursementApprovals) {
      const q = pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM reimbursements WHERE status = "pending_approval" AND pending_approver_id = ?', [currentUserId])
        .then(([rows]) => ({ name: 'reimbursementApprovals', count: Number(rows[0]?.count || 0) }));
      queries.push(q);
    }

    if (canReimbursementPay) {
      const q = pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM reimbursements WHERE status = "approved"')
        .then(([rows]) => ({ name: 'reimbursementPays', count: Number(rows[0]?.count || 0) }));
      queries.push(q);
    }

    if (canCreateReimbursement) {
      const q = pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM reimbursements WHERE status = "rejected" AND (applicant_id = ? OR created_by = ?)', [currentUserId, currentUserId])
        .then(([rows]) => ({ name: 'reimbursementRejected', count: Number(rows[0]?.count || 0) }));
      queries.push(q);
    }

    const results = await Promise.all(queries);
    let totalCount = 0;
    const details: Record<string, number> = {};
    for (const result of results) {
      details[result.name] = result.count;
      totalCount += result.count;
    }

    return NextResponse.json({ success: true, data: { total: totalCount, details } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    console.error('获取代办数量聚合失败:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
