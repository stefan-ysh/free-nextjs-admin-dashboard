import { NextRequest, NextResponse } from 'next/server';

import { deleteWarehouse, getWarehouse, updateWarehouse } from '@/lib/db/inventory';
import type { WarehousePayload } from '@/types/inventory';
import { sanitizeWarehousePayload, validateWarehousePayload } from '../validator';

function notFoundResponse() {
  return NextResponse.json({ error: '仓库不存在' }, { status: 404 });
}

function isDuplicateError(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'ER_DUP_ENTRY'
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ warehouseId: string }> }
) {
  try {
    const { warehouseId } = await params;
    const data = await getWarehouse(warehouseId);
    if (!data) {
      return notFoundResponse();
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[inventory.warehouse] failed to load warehouse', error);
    return NextResponse.json({ error: '获取仓库失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ warehouseId: string }> }
) {
  try {
    const { warehouseId } = await params;
    const raw = (await request.json()) as Partial<WarehousePayload>;
    const payload = sanitizeWarehousePayload(raw);
    const errorMessage = validateWarehousePayload(payload, { partial: true });
    if (errorMessage) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const data = await updateWarehouse(warehouseId, payload);
    if (!data) {
      return notFoundResponse();
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[inventory.warehouse] failed to update warehouse', error);
    if (isDuplicateError(error)) {
      return NextResponse.json({ error: '仓库编码已存在' }, { status: 409 });
    }
    return NextResponse.json({ error: '更新仓库失败' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ warehouseId: string }> }
) {
  try {
    const { warehouseId } = await params;
    const success = await deleteWarehouse(warehouseId);
    if (!success) {
      return notFoundResponse();
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[inventory.warehouse] failed to delete warehouse', error);
    return NextResponse.json({ error: '删除仓库失败' }, { status: 500 });
  }
}
