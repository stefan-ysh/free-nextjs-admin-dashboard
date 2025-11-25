import { NextResponse } from 'next/server';

import { getInventoryStats } from '@/lib/db/inventory';

export async function GET() {
  try {
    const data = await getInventoryStats();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[inventory.stats] failed to load stats', error);
    return NextResponse.json({ error: '获取库存统计失败' }, { status: 500 });
  }
}
