# 进销存（Inventory）模块设计

> 目标：在现有 TailAdmin Next.js 管理后台中，新增一个可自托管的轻量级进销存子系统，覆盖“采购入库 → 库存调拨 → 销售出库 → 数据分析”闭环，复用当前的权限体系、MySQL 存储与 Tailwind UI 规范。

## 1. 功能范围

| 功能块 | 说明 | 关键 UI | API/数据 | 权限建议 |
| --- | --- | --- | --- | --- |
| 库存概览 | 展示总库存、预警、当日出入库 | Dashboard 卡片 + 趋势图 | `/api/inventory/stats` | `INVENTORY_VIEW_DASHBOARD` |
| 商品与SKU | 商品基础信息、单位、条码、预警线 | 表格 + 详情 Drawer | `/api/inventory/items` | `INVENTORY_MANAGE_ITEMS` |
| 仓库/库区 | 仓库档案、可用容量、地址 | 列表 + Map/Badge | `/api/inventory/warehouses` | `INVENTORY_MANAGE_WAREHOUSE` |
| 入库（采购/调拨） | 记录采购入库、退货入库 | 多步表单 + 文件上传 | `/api/inventory/inbound` | `INVENTORY_OPERATE_INBOUND` |
| 出库（销售/领用） | 销售出库、内部领用、退库 | 多步表单 | `/api/inventory/outbound` | `INVENTORY_OPERATE_OUTBOUND` |
| 库存流水 | 可筛选流水、支持导出 CSV | 高级表格（列筛选、日期范围） | `/api/inventory/movements` | `INVENTORY_VIEW_ALL` |
| 警戒与任务 | 低库存提醒、待入库单 | Toast + Badge + 通知中心 | `/api/inventory/alerts` | `INVENTORY_VIEW_DASHBOARD` |

## 2. 页面结构

```
src/app/(admin)/inventory/
  ├─ page.tsx                  # 总览：统计卡片、图表、警戒列表
  ├─ items/page.tsx            # 商品管理
  ├─ warehouses/page.tsx       # 仓库管理
  ├─ inbound/page.tsx          # 入库单
  ├─ outbound/page.tsx         # 出库单
  └─ movements/page.tsx        # 库存流水 & 导出
```

每个页面使用 `AppLayout`，并通过 `generateMetadata` 定义 SEO。公共组件位于 `src/components/inventory/*`，示例：

- `InventoryStatsCards.tsx`
- `InventoryMovementTable.tsx`
- `InventoryForm.tsx`（入/出库复用，传入 `mode`）
- `StockLevelBadge.tsx`
- `WarehouseSelector.tsx`

## 3. 数据模型

```ts
// src/types/inventory.ts
export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unit: string;          // 件 / 箱 / kg
  category: string;
  safetyStock: number;   // 安全库存
  barcode?: string;
  attributes?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: 'main' | 'store' | 'virtual';
  address?: string;
  capacity?: number;
  manager?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockSnapshot {
  itemId: string;
  warehouseId: string;
  quantity: number;
  reserved: number;
  available: number; // quantity - reserved
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  direction: 'inbound' | 'outbound';
  type: 'purchase' | 'transfer' | 'sale' | 'adjust';
  itemId: string;
  warehouseId: string;
  relatedOrderId?: string; // 采购单 / 销售单
  quantity: number;
  unitCost?: number;
  amount?: number;        // quantity * unitCost
  operatorId: string;     // auth user id
  occurredAt: string;
  attachments?: string[]; // 本地或云存储
  notes?: string;
  createdAt: string;
}
```

### 数据库表（MySQL）

```
inventory_items
  id PK, sku UNIQUE, name, unit, category, safety_stock, barcode, attributes_json, created_at, updated_at

inventory_warehouses
  id PK, name, code UNIQUE, type, address, capacity, manager, meta_json, created_at, updated_at

inventory_stock_snapshots
  id PK, item_id FK, warehouse_id FK, quantity, reserved, updated_at

inventory_movements
  id PK, direction ENUM, type ENUM, item_id FK, warehouse_id FK,
  related_order_id, quantity, unit_cost, amount, operator_id, occurred_at,
  attachments_json, notes, created_at

inventory_alerts
  id PK, item_id FK, warehouse_id FK, level ENUM('warning','critical'), message,
  resolved TINYINT(1), created_at, resolved_at
```

索引：`idx_movements_item_date`, `idx_stock_item_wh`, `idx_alerts_resolved`。

## 4. API 设计

所有路由位于 `src/app/api/inventory/*`，使用 `NextRequest` + `mysql2`. 建议结构：

```
/api/inventory/items          GET/POST
/api/inventory/items/[id]     GET/PATCH/DELETE
/api/inventory/warehouses     GET/POST
/api/inventory/warehouses/[id]
/api/inventory/inbound        POST (创建入库单并写 movement)
/api/inventory/outbound       POST
/api/inventory/movements      GET (支持分页、过滤)
/api/inventory/stats          GET (汇总指标)
/api/inventory/alerts         GET/PATCH
```

### 关键流程

1. **入库**
   - 校验权限 `INVENTORY_OPERATE_INBOUND`
   - 写 `inventory_movements` direction=inbound
   - 更新/插入 `inventory_stock_snapshots`
   - 若数量 > safetyStock 清除警戒

2. **出库**
   - 校验可用库存 >= 请求量
   - 写 movement direction=outbound
   - 更新 snapshot.available
   - 若低于安全线→写 `inventory_alerts`

3. **统计**
   - 预计算：
     - 总库存额 = Σ snapshot.available * 最近一次 unit_cost
     - 当日入/出库量 = movements 当日分组
     - 低库存列表 = snapshot.available < item.safety_stock

## 5. 权限与角色映射

在 `src/lib/permissions.ts` 中新增：

```ts
export const Permissions = {
  ...,
  INVENTORY_VIEW_DASHBOARD: { anyRoles: [UserRole.ADMIN, UserRole.OPERATOR] },
  INVENTORY_MANAGE_ITEMS: { anyRoles: [UserRole.ADMIN, UserRole.INVENTORY_MANAGER] },
  INVENTORY_MANAGE_WAREHOUSE: { anyRoles: [UserRole.ADMIN] },
  INVENTORY_OPERATE_INBOUND: { anyRoles: [UserRole.INVENTORY_OPERATOR] },
  INVENTORY_OPERATE_OUTBOUND: { anyRoles: [UserRole.INVENTORY_OPERATOR] },
  INVENTORY_VIEW_ALL: { anyRoles: [UserRole.ADMIN, UserRole.AUDITOR] },
};
```

可在种子脚本 `scripts/create-admin.mjs` 中为管理员授予 `INVENTORY_*`。

## 6. UI/UX 要点

- **导航入口**：在 `AppSidebar` 中添加“进销存”主项，子项：`概览`、`商品`、`仓库`、`入库单`、`出库单`、`库存流水`，根据权限过滤。
- **状态色**：
  - 入库 = brand 500
  - 出库 = error 500
  - 低库存 = warning 500
  - 正常 = success 500
- **表单体验**：使用 `react-hook-form` + `zodResolver`，步骤：1) 基本信息（仓库、日期、类型）2) 商品行（支持批量导入 CSV via `papaparse`）3) 附件备注。
- **表格优化**：`@tanstack/react-table` + 列筛选、粘性表头、右侧统计侧栏。
- **图表**：`react-apexcharts` 折线（30 天出入库）、堆叠柱状（仓库库存）、环形图（品类占比）。
- **导出**：`movements` 页面暴露导出按钮，调用 `GET /api/inventory/movements?format=csv`，服务器流式输出。

## 7. 与现有系统的协同

- **采购/报销联动**：`purchases` 模块在审批通过后可触发 `/api/inventory/inbound`，通过 `relatedOrderId` 建立关联。
- **财务模块**：库存 movement 的金额可同步写入财务表作为成本科目，或定期汇总通过 `cron` 写入 finance 统计。
- **权限复用**：前端菜单和 API 均调用 `usePermissions`/服务端校验，保持一致体验。

## 8. 迭代路线

1. **MVP**：商品/仓库 CRUD、入/出库、库存 snapshot、流水表。
2. **增强**：低库存提醒、图表仪表盘、CSV 导出。
3. **联动**：与采购、财务、项目模块互通单据。
4. **高级**：多仓调拨、序列号/批次、移动端扫码。

---
*更新时间：2025-11-20*
