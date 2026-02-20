import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';
import { createInventoryItem } from '@/lib/db/inventory';
import { logSystemAudit } from '@/lib/audit';

const importItemSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  sku: z.string().min(1, 'SKU不能为空'),
  category: z.string().min(1, '分类不能为空'),
  unit: z.string().min(1, '单位不能为空'),
  safetyStock: z.number().int().min(0).default(0),
});

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.INVENTORY_MANAGE_ITEMS);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: '请提供商品列表' }, { status: 400 });
    }

    const results: Array<{ index: number; success: boolean; sku?: string; error?: string }> = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const parseResult = importItemSchema.safeParse(item);
      
      if (!parseResult.success) {
        results.push({
          index: i,
          success: false,
          sku: item.sku,
          error: parseResult.error.errors.map(e => e.message).join('; '),
        });
        errorCount++;
        continue;
      }

      try {
        const created = await createInventoryItem({
          name: parseResult.data.name,
          sku: parseResult.data.sku,
          category: parseResult.data.category,
          unit: parseResult.data.unit,
          safetyStock: parseResult.data.safetyStock,
        });
        results.push({ index: i, success: true, sku: parseResult.data.sku });
        successCount++;

        await logSystemAudit({
          userId: permissionUser.id,
          userName: permissionUser.displayName,
          action: 'CREATE',
          entityType: 'INVENTORY_ITEM',
          entityId: created.id,
          entityName: parseResult.data.name,
          newValues: { sku: parseResult.data.sku, name: parseResult.data.name, source: 'import' },
        }).catch(() => { /* 审计写入不阻塞导入 */ });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '创建失败';
        results.push({ index: i, success: false, sku: item.sku, error: errorMessage });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total: items.length,
        successCount,
        errorCount,
        results,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('批量导入商品失败', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
