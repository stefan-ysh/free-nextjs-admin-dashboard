import { NextRequest, NextResponse } from 'next/server';

import { createInventoryItem, listInventoryItems } from '@/lib/db/inventory';
import { normalizeInventoryCategory } from '@/lib/inventory/catalog';
import type { InventoryItemPayload } from '@/types/inventory';
import { sanitizeItemPayload, validateItemPayload } from './validator';

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

export async function GET() {
  try {
    const data = await listInventoryItems();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[inventory.items] failed to load items', error);
    return NextResponse.json({ error: '获取商品失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = (await request.json()) as Partial<InventoryItemPayload>;
    const payload = sanitizeItemPayload(raw);
    const errorMessage = validateItemPayload(payload);
    if (errorMessage) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const finalPayload: InventoryItemPayload = {
      sku: (payload.sku && typeof payload.sku === 'string' ? payload.sku.trim() : '') ||
        generateSku(payload.category as string | undefined, payload.name as string | undefined),
      name: String(payload.name ?? '').trim(),
      unit: String(payload.unit ?? '').trim(),
      unitPrice: Number(payload.unitPrice ?? 0),
      category: normalizeInventoryCategory(String(payload.category ?? '未分类')),
      safetyStock: Number(payload.safetyStock ?? 0),
      barcode: payload.barcode?.trim() || undefined,
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
