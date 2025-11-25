import { NextRequest, NextResponse } from 'next/server';

import { listInventoryItems, listMovements, listWarehouses } from '@/lib/db/inventory';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const directionParam = url.searchParams.get('direction');
    const direction =
      directionParam === 'inbound' || directionParam === 'outbound'
        ? directionParam
        : null;

    const [movements, items, warehouses] = await Promise.all([
      listMovements(),
      listInventoryItems(),
      listWarehouses(),
    ]);

    const itemMap = new Map(items.map((item) => [item.id, item]));
    const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

    const filtered = direction
      ? movements.filter((movement) => movement.direction === direction)
      : movements;

    const data = filtered.map((movement) => {
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

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[inventory.movements] failed to load movements', error);
    return NextResponse.json({ error: '获取库存流水失败' }, { status: 500 });
  }
}
