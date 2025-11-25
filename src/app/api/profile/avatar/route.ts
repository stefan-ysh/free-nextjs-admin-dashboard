import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/current-user';
import { updateUserAvatar, UserRecord } from '@/lib/auth/user';
import {
  deleteAvatarAsset,
  isBase64DataUri,
  saveAvatarToLocal,
} from '@/lib/storage/avatar';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB in bytes

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

    // Validate base64 size (approximate check)
    if (avatarInput && isBase64DataUri(avatarInput)) {
      const base64Length = avatarInput.replace(/^data:image\/\w+;base64,/, '').length;
      const approximateSize = (base64Length * 3) / 4; // Convert base64 length to bytes
      
      if (approximateSize > MAX_AVATAR_SIZE) {
        return NextResponse.json(
          { success: false, error: '头像大小超出限制（最大 5MB），请选择更小的图片' },
          { status: 400 }
        );
      }

      const oldAvatar = context.user.avatar_url;
      if (oldAvatar) {
        if (oldAvatar.startsWith('http')) {
          console.warn('检测到远程头像链接, 当前仅支持本地存储, 跳过删除旧头像');
        } else {
          await deleteAvatarAsset(oldAvatar);
        }
      }

      avatarInput = await saveAvatarToLocal(avatarInput);
    } else if (avatarInput === null && context.user.avatar_url) {
      if (context.user.avatar_url.startsWith('http')) {
        console.warn('检测到远程头像链接, 当前仅支持本地存储, 跳过删除旧头像');
      } else {
        await deleteAvatarAsset(context.user.avatar_url);
      }
    }

    const updated = await updateUserAvatar(context.user.id, avatarInput);

    return NextResponse.json({ success: true, data: buildUserShape(updated) });
  } catch (error) {
    console.error('更新头像失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
