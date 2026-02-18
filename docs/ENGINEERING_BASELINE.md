# 技术规范基线（研发）

## 1. 禁止再依赖的历史表
- `purchase_payments`
- `purchase_workflow_configs`
- `projects`
- `project_payments`
- `calendar_events`
- `clients`
- `client_contacts`
- `client_logs`

## 2. 财务数据来源规范
`finance_records.source_type` 仅允许：
- `manual`
- `reimbursement`
- `budget_adjustment`
- `inventory`

关联字段：
- 使用 `reimbursement_id` 关联报销打款记录。
- 不再使用 `purchase_payment_id`。

## 3. 预算调整技术设计
- 表：`finance_budget_adjustments`
- API：`/api/finance/budget-adjustments` (`GET/POST`)
- 写入策略：每条预算调整同步写入一条 `finance_records` 用于统计。

## 4. 附件与存储
- COS 作为附件存储。
- 列表展示优先原始文件名。
- 预览优先弹窗内完成。
- AccessDenied 排查顺序：签名 URL -> 桶策略 -> CORS -> key 前缀。

## 5. 日期与时区
- 表单日期统一使用 shadcn 日期组件。
- 保存和展示按 `Asia/Shanghai` 业务语义处理。
- 严禁出现 UTC 偏移导致日期跨天。

## 6. 迁移与清理
- 清理脚本：`scripts/cleanup_removed_modules.sql`
- 执行前先备份 DB。
- 不可清理系统基础主数据（员工、角色、物品目录等）。

## 7. 发布前技术检查
1. `npm run build` 必须通过。
2. 采购、报销关键 API 无 4xx/5xx 异常。
3. 关联采购报销的后端校验生效（非对公、已入库、未占用）。
4. 待办/已办聚合口径与页面一致。
5. 通知文案与流程节点一致。
