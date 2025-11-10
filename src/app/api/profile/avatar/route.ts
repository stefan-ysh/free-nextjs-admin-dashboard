import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/current-user';
import { updateUserAvatar, UserRecord } from '@/lib/auth/user';

const MAX_AVATAR_CHAR_LENGTH = 1_200_000; // ~900KB binary payload in base64

function buildUserShape(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.first_name,
    lastName: user.last_name,
    displayName: user.display_name,
    jobTitle: user.job_title,
    phone: user.phone,
    bio: user.bio,
    country: user.country,
    city: user.city,
    postalCode: user.postal_code,
    taxId: user.tax_id,
    avatarUrl: user.avatar_url,
    socialLinks: user.social_links,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    passwordUpdatedAt: user.password_updated_at,
  };
}

export async function PUT(request: Request) {
  try {
    const context = await getCurrentUser();
    if (!context) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let avatarInput: string | null = null;

    if (typeof body.avatar === 'string') {
      avatarInput = body.avatar.trim();
    } else if (typeof body.avatarUrl === 'string') {
      avatarInput = body.avatarUrl.trim();
    } else if (body.clear === true) {
      avatarInput = null;
    }

    if (avatarInput && avatarInput.length > MAX_AVATAR_CHAR_LENGTH) {
      return NextResponse.json({ success: false, error: '头像大小超出限制，请选择更小的图片' }, { status: 400 });
    }

    const updated = await updateUserAvatar(context.user.id, avatarInput);

    return NextResponse.json({ success: true, data: buildUserShape(updated) });
  } catch (error) {
    console.error('更新头像失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
