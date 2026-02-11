import { NextRequest, NextResponse } from 'next/server';

import { listOperationalWarehouses } from '@/lib/db/inventory';
import type { WarehousePayload } from '@/types/inventory';
import { sanitizeWarehousePayload, validateWarehousePayload } from './validator';

function isDuplicateError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ER_DUP_ENTRY'
  );
}

export async function GET() {
  try {
    const data = await listOperationalWarehouses();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[inventory.warehouses] failed to load warehouses', error);
    return NextResponse.json({ error: '获取仓库失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const _raw = (await request.json()) as Partial<WarehousePayload>;
    const _payload = sanitizeWarehousePayload(_raw);
    const _errorMessage = validateWarehousePayload(_payload);
    return NextResponse.json(
      { error: '仓库已固定为“学校/单位”两类，不支持新增。' },
      { status: 403 }
    );
  } catch (error) {
    console.error('[inventory.warehouses] failed to create warehouse', error);
    if (isDuplicateError(error)) {
      return NextResponse.json({ error: '仓库编码已存在' }, { status: 409 });
    }
    return NextResponse.json({ error: '创建仓库失败' }, { status: 500 });
  }
}
