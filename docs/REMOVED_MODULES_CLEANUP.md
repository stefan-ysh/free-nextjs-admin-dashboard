# Removed Modules Cleanup Runbook

更新日期：2026-02-18

## 目标
安全清理已下线模块表：
- `purchase_workflow_configs`
- `purchase_payments`
- `project_payments`
- `projects`
- `calendar_events`
- `client_logs`
- `client_contacts`
- `clients`

## 步骤
1. 先备份数据库。
2. 执行预检查：
```bash
npm run check:cleanup-removed
```
3. 若输出 `Result: PASS`，再执行：
```bash
npm run cleanup:removed-modules
```

## 预检查会做什么
- 检查目标表是否存在与行数。
- 检查是否有外键仍引用这些目标表。
- 检查 `finance_records.purchase_payment_id` 遗留列状态。

## 阻断条件
出现以下情况不要执行清理 SQL：
- 预检查输出 `Result: BLOCKED`
- 发现非目标表仍外键依赖目标表

## 清理后验证
- `npm run build` 通过
- 采购、报销、到货入库、财务打款主流程可用
- 菜单与权限无异常（无多余模块入口）
