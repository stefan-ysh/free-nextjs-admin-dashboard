import { NextRequest, NextResponse } from 'next/server';

import {
  deleteInventoryItem,
  getInventoryItem,
  updateInventoryItem,
} from '@/lib/db/inventory';
import type { InventoryItemPayload } from '@/types/inventory';
import { sanitizeItemPayload, validateItemPayload } from '../validator';

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
    const raw = (await request.json()) as Partial<InventoryItemPayload>;
    const payload = sanitizeItemPayload(raw);
    const errorMessage = validateItemPayload(payload, { partial: true });
    if (errorMessage) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
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
    return NextResponse.json({ error: '删除商品失败' }, { status: 500 });
  }
}
