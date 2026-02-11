# 短信通知接入指南（采购审批/报销流程）

## 1. 接入结论

不需要开发独立版本。  
当前系统已支持短信通知驱动，采购流程节点通知统一走短信网关。

## 2. 已接入通知节点

1. 采购提交审批：通知审批侧（`purchase_submitted`）。
2. 审批通过：通知申请人可采购并补发票（`purchase_approved`）。
3. 提交报销：通知财务待处理（`reimbursement_submitted`）。
4. 财务打款：通知申请人流程完成（`purchase_paid`）。

## 3. 环境变量

```dotenv
SMS_NOTIFY_ENABLED="1"
NOTIFY_POLICY_JSON=""
SMS_WEBHOOK_URL="https://your-sms-gateway.example.com/notify"

# 可选：按通道拆分网关
SMS_WEBHOOK_APPROVAL_URL=""
SMS_WEBHOOK_APPLICANT_URL=""
SMS_WEBHOOK_FINANCE_URL=""

# 可选：网关鉴权
SMS_WEBHOOK_TOKEN=""

# 可选：回退号码（逗号分隔）
SMS_FALLBACK_PHONES=""
SMS_FALLBACK_APPROVAL_PHONES=""
SMS_FALLBACK_APPLICANT_PHONES=""
SMS_FALLBACK_FINANCE_PHONES=""

APP_BASE_URL="http://localhost:3000"
```

`NOTIFY_POLICY_JSON` 可按事件控制是否发送和发送通道：

```json
{
  "purchase_submitted": { "enabled": true, "channels": ["sms", "in_app"] },
  "purchase_approved": { "enabled": true, "channels": ["sms", "in_app"] },
  "reimbursement_submitted": { "enabled": true, "channels": ["sms", "in_app"] },
  "purchase_paid": { "enabled": true, "channels": ["sms", "in_app"] }
}
```

- `sms`：短信网关（当前已接入）
- `in_app`：站内待办（当前已接入，写入 `app_notifications`）
- `email`：邮件（当前为占位通道，便于后续扩展）

## 4. 短信网关请求格式

系统会向 `SMS_WEBHOOK_*` 发送 `POST application/json`：

```json
{
  "channel": "approval",
  "phones": ["13800138000", "13900139000"],
  "content": "【采购待审批】\\n采购单号：CG20260123001\\n...",
  "app": "admin_cosmorigin"
}
```

- `channel`：`approval` / `applicant` / `finance`
- `phones`：优先员工手机号；缺失时用 `SMS_FALLBACK_*`
- `content`：短信正文（已含业务关键字段）

如果配置了 `SMS_WEBHOOK_TOKEN`，会附加请求头：

`Authorization: Bearer <token>`

## 5. 精准触达规则

1. 系统从 `hr_employees.phone` 读取手机号。
2. 审批通知：发给当前审批人手机号。
3. 申请人通知：发给采购申请人手机号。
4. 财务通知：发给角色为 `finance/admin/super_admin` 的在职员工手机号。
5. 如果目标手机号为空，则回退到 `SMS_FALLBACK_*` 配置。

## 6. 联调步骤

1. 在 `.env.local` 开启 `SMS_NOTIFY_ENABLED=1` 并配置网关地址。
2. 确认员工信息中已维护手机号（组织架构 -> 员工管理）。
3. 提交采购单，检查审批短信是否送达。
4. 审批通过后，检查申请人短信。
5. 提交报销后，检查财务短信。
6. 财务打款后，检查完成短信。

## 7. 网关返回约定

系统判定规则：

- HTTP `2xx` 视为网关可达。
- 若响应体包含 `{ "success": false }`，视为发送失败并记日志。

建议网关统一返回：

```json
{ "success": true, "requestId": "sms-xxxx" }
```
