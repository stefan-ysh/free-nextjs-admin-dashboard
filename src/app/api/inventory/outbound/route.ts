import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import {
  createOutboundRecord,
  INVENTORY_ERRORS,
  revertOutboundMovement,
} from '@/lib/db/inventory';
import { checkPermission, Permissions } from '@/lib/permissions';
import type { InventoryOutboundPayload } from '@/types/inventory';
import { createSaleIncome } from '@/lib/services/finance-automation';

function unauthorizedResponse() {
  return NextResponse.json({ error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ error: '无权访问' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.INVENTORY_OPERATE_OUTBOUND);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const payload = (await request.json()) as InventoryOutboundPayload;

    if (!payload.itemId || !payload.warehouseId || !payload.quantity) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 });
    }

    if (payload.quantity <= 0) {
      return NextResponse.json({ error: '数量必须大于 0' }, { status: 400 });
    }

    const movement = await createOutboundRecord(payload, permissionUser.id);

    if (movement.type === 'sale') {
      try {
        await createSaleIncome(movement, permissionUser.id);
      } catch (automationError) {
        console.error('[inventory.outbound] finance automation failed', automationError);
        try {
          await revertOutboundMovement(movement);
        } catch (revertError) {
          console.error('[inventory.outbound] failed to revert movement after automation error', revertError);
        }
        return NextResponse.json({ error: '财务自动化失败，出库操作已回滚' }, { status: 500 });
      }
    }

    return NextResponse.json({ data: movement }, { status: 201 });
  } catch (error) {
    console.error('[inventory.outbound] failed to create outbound record', error);
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return unauthorizedResponse();
      }
      if (error.message === INVENTORY_ERRORS.ITEM_NOT_FOUND) {
        return NextResponse.json({ error: '商品不存在' }, { status: 404 });
      }
      if (error.message === INVENTORY_ERRORS.WAREHOUSE_NOT_FOUND) {
        return NextResponse.json({ error: '仓库不存在' }, { status: 404 });
      }
      if (error.message === INVENTORY_ERRORS.TRANSFER_TARGET_REQUIRED) {
        return NextResponse.json({ error: '调拨需要选择目标仓库' }, { status: 400 });
      }
      if (error.message === INVENTORY_ERRORS.TRANSFER_TARGET_NOT_FOUND) {
        return NextResponse.json({ error: '目标仓库不存在' }, { status: 404 });
      }
      if (error.message === INVENTORY_ERRORS.TRANSFER_SAME_WAREHOUSE) {
        return NextResponse.json({ error: '目标仓库不能与来源仓库相同' }, { status: 400 });
      }
      if (error.message === INVENTORY_ERRORS.INSUFFICIENT_STOCK) {
        return NextResponse.json({ error: '可用库存不足' }, { status: 409 });
      }
    }
    return NextResponse.json({ error: '创建出库单失败' }, { status: 500 });
  }
}
