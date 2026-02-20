import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { listUsers } from '@/lib/users';
import { mysqlPool } from '@/lib/mysql';
import { UserRole } from '@/types/user';

const APPROVAL_ROLES: readonly UserRole[] = [UserRole.APPROVER];

type ApproverLoadRow = RowDataPacket & {
  pending_approver_id: string;
  pending_count: number;
};

export async function GET() {
  try {
    const context = await requireCurrentUser();
    const excludeSelf = true;

    const result = await listUsers({
      page: 1,
      pageSize: 200,
      isActive: true,
    });

    const approvers = result.items.filter((user) => {
      if (!user.primaryRole) return false;
      if (!APPROVAL_ROLES.includes(user.primaryRole)) return false;
      if (excludeSelf && user.id === context.user.id) return false;
      if (user.primaryRole === UserRole.SUPER_ADMIN) return false;
      return true;
    });

    const pool = mysqlPool();
    const [loadRows] = await pool.query<ApproverLoadRow[]>(
      `SELECT pending_approver_id, COUNT(*) AS pending_count
       FROM purchases
       WHERE is_deleted = 0
         AND status = 'pending_approval'
         AND pending_approver_id IS NOT NULL
       GROUP BY pending_approver_id`
    );
    const loadMap = new Map(loadRows.map((row) => [row.pending_approver_id, Number(row.pending_count ?? 0)]));

    const withLoad = approvers.map((user) => ({
      ...user,
      pendingApprovalCount: loadMap.get(user.id) ?? 0,
    }));

    withLoad.sort((a, b) => {
      const diff = (a.pendingApprovalCount ?? 0) - (b.pendingApprovalCount ?? 0);
      if (diff !== 0) return diff;
      return a.displayName.localeCompare(b.displayName, 'zh-CN');
    });

    return NextResponse.json({ success: true, data: withLoad });
  } catch (error) {
    console.error('获取审批人列表失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
