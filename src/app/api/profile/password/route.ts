import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/current-user';
import { logAuthAudit } from '@/lib/auth/audit';
import { verifyPassword } from '@/lib/auth/password';
import { updateUserPassword } from '@/lib/auth/user';

export async function PUT(request: Request) {
  try {
    const context = await getCurrentUser();
    if (!context) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: '请输入当前密码和新密码' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: '新密码至少需要 8 个字符' }, { status: 400 });
    }

    if (confirmPassword && confirmPassword !== newPassword) {
      return NextResponse.json({ success: false, error: '两次输入的新密码不一致' }, { status: 400 });
    }

    const passwordOk = await verifyPassword(currentPassword, context.user.password_hash);
    if (!passwordOk) {
      return NextResponse.json({ success: false, error: '当前密码不正确' }, { status: 400 });
    }

    if (await verifyPassword(newPassword, context.user.password_hash)) {
      return NextResponse.json({ success: false, error: '新密码不能与旧密码相同' }, { status: 400 });
    }

    await updateUserPassword(context.user.id, newPassword);
    
    // Auth audit (legacy/internal table)
    await logAuthAudit({
      actorId: context.user.id,
      targetId: context.user.id,
      action: 'password.change',
    });

    // System audit (visible in main UI)
    const { logSystemAudit } = await import('@/lib/audit');
    await logSystemAudit({
      userId: context.user.id,
      userName: context.user.display_name ?? '未知用户',
      action: 'UPDATE',
      entityType: 'EMPLOYEE',
      entityId: context.user.id,
      entityName: context.user.display_name ?? undefined,
      description: `${context.user.display_name ?? '未知用户'} 修改了系统登录密码`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新密码失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
