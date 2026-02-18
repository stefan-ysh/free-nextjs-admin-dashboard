import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { createInboundRecord, INVENTORY_ERRORS } from '@/lib/db/inventory';
import { findPurchaseById } from '@/lib/db/purchases';
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
    const payload = (await request.json()) as InventoryInboundPayload;

    if (!payload.itemId || !payload.warehouseId || !payload.quantity) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 });
    }

    if (payload.quantity <= 0) {
      return NextResponse.json({ error: '数量必须大于 0' }, { status: 400 });
    }

    const inventoryInboundPerm = await checkPermission(permissionUser, Permissions.INVENTORY_OPERATE_INBOUND);
    const ownPurchaseInboundPerm = await checkPermission(
      permissionUser,
      Permissions.INVENTORY_INBOUND_CREATE_OWN_PURCHASE_ONLY
    );
    if (!inventoryInboundPerm.allowed && !ownPurchaseInboundPerm.allowed) {
      return forbiddenResponse();
    }

    if (!inventoryInboundPerm.allowed && ownPurchaseInboundPerm.allowed) {

      if (payload.type !== 'purchase') {
        return NextResponse.json({ error: '当前仅允许对采购单执行入库' }, { status: 403 });
      }
      const relatedPurchaseId = payload.relatedPurchaseId?.trim();
      if (!relatedPurchaseId) {
        return NextResponse.json({ error: '请先关联采购单后再入库' }, { status: 400 });
      }
      const purchase = await findPurchaseById(relatedPurchaseId);
      if (!purchase || purchase.isDeleted) {
        return NextResponse.json({ error: '关联采购单不存在' }, { status: 404 });
      }
      if (purchase.status !== 'pending_inbound' && purchase.status !== 'approved' && purchase.status !== 'paid') {
        return NextResponse.json({ error: '当前采购单状态不允许入库' }, { status: 400 });
      }
      const isOwner = purchase.createdBy === permissionUser.id || purchase.purchaserId === permissionUser.id;
      if (!isOwner) {
        return NextResponse.json({ error: '仅可对本人采购单执行入库' }, { status: 403 });
      }
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
      if (error.message === INVENTORY_ERRORS.PURCHASE_NOT_FOUND) {
        return NextResponse.json({ error: '关联采购单不存在' }, { status: 404 });
      }
      if (error.message === INVENTORY_ERRORS.PURCHASE_STATUS_INVALID) {
        return NextResponse.json({ error: '当前采购单状态不允许入库' }, { status: 400 });
      }
      if (error.message === INVENTORY_ERRORS.PURCHASE_ITEM_MISMATCH) {
        return NextResponse.json({ error: '入库商品与关联采购单不一致' }, { status: 400 });
      }
      if (error.message === INVENTORY_ERRORS.PURCHASE_INBOUND_EXCEEDS) {
        return NextResponse.json({ error: '入库数量超过采购单剩余可入库数量' }, { status: 400 });
      }
    }
    return NextResponse.json({ error: '创建入库单失败' }, { status: 500 });
  }
}
