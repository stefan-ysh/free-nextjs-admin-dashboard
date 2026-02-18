import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/current-user';
import { updateUserProfile, UserRecord } from '@/lib/auth/user';

function buildUserShape(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
    gender: user.gender,
    phone: user.phone,
    address: user.address,
    bio: user.bio,
    country: user.country,
    city: user.city,
    postalCode: user.postal_code,
    taxId: user.tax_id,
    socialLinks: user.social_links,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    passwordUpdatedAt: user.password_updated_at,
  };
}

function sanitizeSocialLinks(input: unknown) {
  if (!input || typeof input !== 'object') return {};
  const links: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof key !== 'string' || !key.trim()) continue;
    if (typeof value === 'string' && value.trim()) {
      links[key.trim()] = value.trim();
    } else if (value == null) {
      links[key.trim()] = null;
    }
  }
  return links;
}

export async function GET() {
  try {
    const context = await getCurrentUser();
    if (!context) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    return NextResponse.json({ success: true, data: buildUserShape(context.user) });
  } catch (error) {
    console.error('获取个人资料失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const context = await getCurrentUser();
    if (!context) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const payload = {
      displayName: typeof body.displayName === 'string' ? body.displayName : null,
      gender: typeof body.gender === 'string' ? body.gender : null,
      phone: typeof body.phone === 'string' ? body.phone : null,
      address: typeof body.address === 'string' ? body.address : null,
      bio: typeof body.bio === 'string' ? body.bio : null,
      country: typeof body.country === 'string' ? body.country : null,
      city: typeof body.city === 'string' ? body.city : null,
      postalCode: typeof body.postalCode === 'string' ? body.postalCode : null,
      taxId: typeof body.taxId === 'string' ? body.taxId : null,
      socialLinks: sanitizeSocialLinks(body.socialLinks),
    };

    const updated = await updateUserProfile(context.user.id, payload);

    return NextResponse.json({ success: true, data: buildUserShape(updated) });
  } catch (error) {
    if (error instanceof Error && error.message === 'DISPLAY_NAME_REQUIRED') {
      return NextResponse.json({ success: false, error: '姓名不能为空' }, { status: 400 });
    }
    console.error('更新个人资料失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
