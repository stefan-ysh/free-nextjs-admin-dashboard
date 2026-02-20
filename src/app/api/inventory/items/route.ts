import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { createInventoryItem, listInventoryItems } from '@/lib/db/inventory';
import { normalizeInventoryCategory } from '@/lib/inventory/catalog';
import { inventoryItemSchema } from '@/lib/validations/inventory';

function slugify(input?: string) {
  if (!input) return '';
  return input
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

function generateSku(category?: string, name?: string) {
  const base = slugify(category) || slugify(name) || 'INV';
  const prefix = base.slice(0, 6) || 'INV';
  const randomPart = Math.random().toString(36).slice(-4).toUpperCase();
  const timePart = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${timePart}${randomPart}`;
}

function isDuplicateError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ER_DUP_ENTRY'
  );
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;

    const { items, total } = await listInventoryItems({ page, limit, search, category });
    return NextResponse.json({ data: items, total });
  } catch (error) {
    console.error('[inventory.items] failed to load items', error);
    return NextResponse.json({ error: '获取商品失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const result = inventoryItemSchema.safeParse(raw);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || '请求参数格式错误' },
        { status: 400 }
      );
    }

    const payload = result.data;

    const finalPayload = {
      sku: payload.sku || generateSku(payload.category, payload.name),
      name: payload.name,
      unit: payload.unit,
      category: normalizeInventoryCategory(payload.category),
      safetyStock: payload.safetyStock,
      imageUrl: payload.imageUrl,
      specFields: payload.specFields,
    };

    const data = await createInventoryItem(finalPayload);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[inventory.items] failed to create item', error);
    if (isDuplicateError(error)) {
      return NextResponse.json({ error: 'SKU 已存在，请更换后重试' }, { status: 409 });
    }
    return NextResponse.json({ error: '创建商品失败' }, { status: 500 });
  }
}
