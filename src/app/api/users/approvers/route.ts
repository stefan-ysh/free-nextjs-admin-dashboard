import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { listUsers } from '@/lib/users';
import { Permissions } from '@/lib/permissions';

/** Roles that grant purchase approval permission — derived from the canonical permission config. */
const APPROVAL_ROLES = Permissions.PURCHASE_APPROVE.anyRoles ?? [];


export async function GET() {
  try {
    await requireCurrentUser();

    const result = await listUsers({
      page: 1,
      pageSize: 200,
      isActive: true,
    });

    const approvers = result.items.filter((user) => {
      const allRoles = new Set(user.roles ?? []);
      if (user.primaryRole) allRoles.add(user.primaryRole);
      return APPROVAL_ROLES.some((role) => allRoles.has(role));
    });

    return NextResponse.json({ success: true, data: approvers });
  } catch (error) {
    console.error('获取审批人列表失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
