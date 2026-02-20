import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import {
  deleteInventoryItem,
  getInventoryItem,
  updateInventoryItem,
  INVENTORY_ERRORS,
} from '@/lib/db/inventory';
import { normalizeInventoryCategory } from '@/lib/inventory/catalog';
import { inventoryItemUpdateSchema } from '@/lib/validations/inventory';

function notFoundResponse() {
  return NextResponse.json({ error: '商品不存在' }, { status: 404 });
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
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const data = await getInventoryItem(itemId);
    if (!data) {
      return notFoundResponse();
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[inventory.item] failed to load item', error);
    return NextResponse.json({ error: '获取商品失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const raw = await request.json();
    const result = inventoryItemUpdateSchema.safeParse(raw);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || '请求参数格式错误' },
        { status: 400 }
      );
    }

    const payload = result.data;
    if (payload.category !== undefined) {
      payload.category = normalizeInventoryCategory(String(payload.category));
    }

    const data = await updateInventoryItem(itemId, payload);
    if (!data) {
      return notFoundResponse();
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[inventory.item] failed to update item', error);
    if (isDuplicateError(error)) {
      return NextResponse.json({ error: 'SKU 已存在，请更换后重试' }, { status: 409 });
    }
    return NextResponse.json({ error: '更新商品失败' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const success = await deleteInventoryItem(itemId);
    if (!success) {
      return notFoundResponse();
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[inventory.item] failed to delete item', error);
    if (error instanceof Error && error.message === INVENTORY_ERRORS.ITEM_IN_USE) {
      return NextResponse.json({ error: '该商品仍有库存或历史出入库记录，无法删除' }, { status: 409 });
    }
    return NextResponse.json({ error: '删除商品失败' }, { status: 500 });
  }
}
