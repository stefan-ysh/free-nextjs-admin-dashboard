import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { listUsers } from '@/lib/users';

export async function GET(request: Request) {
    try {
        await requireCurrentUser();
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') ?? undefined;
        const page = Number.parseInt(searchParams.get('page') ?? '1', 10);
        const pageSize = Number.parseInt(searchParams.get('pageSize') ?? '50', 10);

        const result = await listUsers({
            search,
            page,
            pageSize,
            isActive: true, // Only list active users
        });

        return NextResponse.json({ success: true, data: result.items });
    } catch (error) {
        console.error('获取用户列表失败', error);
        return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
    }
}
