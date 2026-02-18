# Data Model (Current Baseline)

更新日期：2026-02-18

本文档仅描述当前仍在使用的数据模型。历史模块（项目、客户、日程、采购付款分表）已下线。

## 1. 当前核心业务表
- `hr_employees`：员工主档、角色、主角色。
- `purchases`：采购申请主表（审批、驳回、待入库、已完成等状态）。
- `reimbursement_logs`：报销主表（草稿、待打款、已打款、驳回）。
- `inventory_items`：商品目录。
- `inventory_warehouses`：仓库。
- `inventory_movements`：出入库流水（包含采购关联字段）。
- `inventory_stock_snapshots`：库存快照。
- `finance_records`：收支流水（含预算调整、报销打款落账）。
- `finance_budget_adjustments`：预算调整主表。
- `finance_categories`：财务分类。
- `app_notifications`：应用内通知。
- `auth_sessions` / `auth_audit_logs`：会话与认证审计。

## 2. 当前流程关系

### 2.1 采购流程
1. 员工发起采购（`purchases`）。
2. 审批管理员审批/驳回（`purchases` 状态变化 + 审计日志）。
3. 审批通过后进入待入库，由申请人或有权限人员执行入库（`inventory_movements`）。
4. 入库完成后采购流程结束。

说明：采购流程不再包含财务打款节点。

### 2.2 报销流程
1. 员工发起报销（`reimbursement_logs`），可选关联采购单。
2. 关联采购时，系统仅允许选择“非对公转账”且满足入库条件的采购单。
3. 财务（学校/单位）处理报销：打款或驳回。
4. 打款后写入 `finance_records`（支出流水）。

## 3. 已下线表（应删除）
- `purchase_payments`
- `purchase_workflow_configs`
- `projects`
- `project_payments`
- `calendar_events`
- `clients`
- `client_contacts`
- `client_logs`

## 4. 约束建议
- 报销关联采购：同一采购单只允许存在一条未删除报销记录。
- 自动生成流水（如报销打款）不允许手工编辑删除。
- 预算调整记录允许编辑，并同步更新对应 `finance_records`。

## 5. 参考文档
- `docs/BUSINESS_BASELINE.md`
- `docs/DEVELOPMENT_BASELINE.md`
- `docs/ENGINEERING_BASELINE.md`
