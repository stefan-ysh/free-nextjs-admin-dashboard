import { NextRequest, NextResponse } from 'next/server';

import { listInventoryItems, listMovements, listWarehouses } from '@/lib/db/inventory';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const directionParam = url.searchParams.get('direction');
    const direction =
      directionParam === 'inbound' || directionParam === 'outbound'
        ? directionParam
        : undefined;

    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('pageSize') || url.searchParams.get('limit') || '50', 10);
    const itemId = url.searchParams.get('itemId') || undefined;
    const warehouseId = url.searchParams.get('warehouseId') || undefined;

    const [movementsResult, itemsRes, warehouses] = await Promise.all([
      listMovements({ page, limit, direction, itemId, warehouseId }),
      listInventoryItems({ limit: 10000 }), // Fetch all items for mapping
      listWarehouses(),
    ]);

    const itemMap = new Map(itemsRes.items.map((item) => [item.id, item]));
    const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

    const data = movementsResult.items.map((movement) => {
      const item = itemMap.get(movement.itemId);
      const specSummary = item?.specFields?.length
        ? item.specFields
            .map((field) => `${field.label}: ${movement.attributes?.[field.key] ?? '-'}`)
            .join(' / ')
        : undefined;

      return {
        ...movement,
        itemName: item?.name,
        warehouseName: warehouseMap.get(movement.warehouseId)?.name,
        specSummary,
      };
    });

    return NextResponse.json({ data, total: movementsResult.total, page, limit });
  } catch (error) {
    console.error('[inventory.movements] failed to load movements', error);
    return NextResponse.json({ error: '获取库存流水失败' }, { status: 500 });
  }
}
