import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { createInboundRecord, INVENTORY_ERRORS } from '@/lib/db/inventory';
import { checkPermission, Permissions } from '@/lib/permissions';
import type { InventoryInboundPayload } from '@/types/inventory';

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
    const perm = await checkPermission(permissionUser, Permissions.INVENTORY_OPERATE_INBOUND);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const payload = (await request.json()) as InventoryInboundPayload;

    if (!payload.itemId || !payload.warehouseId || !payload.quantity) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 });
    }

    if (payload.quantity <= 0) {
      return NextResponse.json({ error: '数量必须大于 0' }, { status: 400 });
    }

    const data = await createInboundRecord(payload, permissionUser.id);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[inventory.inbound] failed to create inbound record', error);
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
    }
    return NextResponse.json({ error: '创建入库单失败' }, { status: 500 });
  }
}
