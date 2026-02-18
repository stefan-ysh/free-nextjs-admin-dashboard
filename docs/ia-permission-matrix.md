# 模块菜单信息架构（IA）与页面权限矩阵

更新日期：2026-02-15

## 0. 全局访问前提
- 所有后台页面均要求已登录会话，否则重定向到 `/signin`。
- 代码位置：`src/app/(admin)/layout.tsx`

## 1. IA（信息架构）

### 一级导航：仪表盘
- 二级：运营概览
- 路由：`/`
- 目标：跨模块指标总览（采购、库存、财务、人事）

### 一级导航：财务管理
- 二级：财务流水
- 路由：`/finance`
- 目标：收支流水查询、预算调整记录
- 二级：付款任务
- 路由：`/finance/payments`
- 目标：仅处理报销打款任务（确认打款/驳回）

### 一级导航：采购管理
- 二级：采购台账
- 路由：`/purchases`
- 目标：采购单查询与发起
- 二级：采购审批
- 路由：`/purchases/approvals`
- 目标：审批、驳回、转交（不含打款）
- 二级：流程监控
- 路由：`/purchases/monitor`
- 目标：流程时效与异常监控
- 二级：审计日志
- 路由：`/purchases/audit`
- 目标：行为审计追溯

### 一级导航：工作台
- 二级：待办
- 路由：`/workflow/todo`
- 目标：审批待办与待财务任务
- 二级：已办
- 路由：`/workflow/done`
- 目标：本人历史处理记录
- 二级：通知
- 路由：`/workflow/notifications`
- 目标：系统消息与业务通知

### 一级导航：进销存
- 二级：概览
- 路由：`/inventory`
- 目标：库存概览、预警、快捷入库/出库
- 二级：商品目录
- 路由：`/inventory/items`
- 目标：SKU 与规格管理
- 二级：库存流水
- 路由：`/inventory/movements`
- 目标：出入库明细查询

### 一级导航：人员管理
- 二级：员工管理
- 路由：`/employees`
- 目标：员工档案与账号管理

### 非菜单但可访问页面
- 路由：`/profile`（个人资料）
- 路由：`/purchases/new`（发起采购）
- 路由：`/purchases/[id]/edit`（采购编辑）

## 2. 页面权限矩阵（可执行）

| 页面路由 | 前端页面访问条件 | 关键后端 API 权限 | 最低建议权限集 |
|---|---|---|---|
| `/` | 登录即可进入页面，模块卡片按权限显示 | 各模块 API 分别校验 | 任意登录账号 |
| `/finance` | `FINANCE_VIEW_ALL` 或 `FINANCE_MANAGE`（在页面中判定可见/可管理） | `/api/finance/*`：`FINANCE_VIEW_ALL` / `FINANCE_MANAGE` | 财务角色（FINANCE*） |
| `/finance/payments` | `REIMBURSEMENT_PAY` | `/api/finance/payments*`（报销支付口径） | 学校财务/单位财务 |
| `/purchases` | `PURCHASE_CREATE` 或 `PURCHASE_VIEW_ALL` | `/api/purchases` 同上 | 普通采购申请人（至少 CREATE） |
| `/purchases/new` | `PURCHASE_CREATE` | `/api/purchases` POST：`PURCHASE_CREATE` | 采购申请人 |
| `/purchases/[id]/edit` | `PURCHASE_UPDATE` 或 `PURCHASE_APPROVE`，且业务规则允许 | `/api/purchases/[id]` + workflow handler | 申请人或审批人 |
| `/purchases/approvals` | `PURCHASE_APPROVE` 或 `PURCHASE_REJECT` | `/api/purchases/approvals` 同上 | 审批管理员 |
| `/purchases/monitor` | `PURCHASE_MONITOR_VIEW` | `/api/purchases/monitor` 同上 | 审批管理员及以上 |
| `/purchases/audit` | `PURCHASE_AUDIT_VIEW` | `/api/purchases/audit` 同上 | 审批管理员及以上 |
| `/workflow/todo` | 登录可访问，数据按权限过滤 | 依赖采购审批/到货入库/报销打款 API | 与当前角色待办职责一致 |
| `/workflow/done` | 登录可访问 | 依赖 `/api/purchases` | 与采购权限一致 |
| `/workflow/notifications` | 登录可访问 | `/api/notifications`：登录即可 | 任意登录账号 |
| `/inventory` | `INVENTORY_VIEW_DASHBOARD`（无则显示无权） | `/api/inventory/stats` 等 | 库存角色 |
| `/inventory/items` | `INVENTORY_MANAGE_ITEMS` | `/api/inventory/items*`：管理权限 | 库存管理员 |
| `/inventory/movements` | `INVENTORY_VIEW_ALL` | `/api/inventory/movements`：查看权限 | 审计/管理员 |
| `/employees` | `USER_VIEW_ALL`（无则阻断） | `/api/employees*`：`USER_VIEW_ALL/CREATE/UPDATE/DELETE` | HR/管理员 |
| `/profile` | 登录可访问 | `/api/profile*`：登录即可 | 任意登录账号 |

## 3. 当前缺口与执行项

### P0（本周内）
- 统一页面标题层级规范：主页面统一 `h1`，区块统一 `h2`，避免混用导致视觉层级不稳定。

### P1（两周内）
- 将“非菜单页面”建立入口策略：保留显式入口（按钮跳转）或改为受控隐藏并文档化。
- 清理历史 ESLint 错误，确保 `npm run lint` 可作为 CI 质量门禁。

### P2（排期优化）
- 评估并移除未使用的日程模块残留（当前已删除页面路由，但 `/api/calendar/events*` 与 `src/components/calendar/Calendar.tsx` 仍在代码中）。
