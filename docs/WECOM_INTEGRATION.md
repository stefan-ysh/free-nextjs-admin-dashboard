# 企业微信接入指南（采购审批/报销流程）

## 1. 是否需要单独开发企业微信版本

不需要单独做一套系统。  
当前做法是同一套后台 + 移动轻量入口：

1. PC 端：复杂录入（采购建单、附件管理、完整列表）。
2. 企业微信/手机端：仅查阅 + 审批 + 打款确认（轻流程）。
3. 通知链接默认跳转到移动页：`/m/tasks/:id`。

## 2. 已接入的通知节点

当前已自动发送：

1. 采购提交审批：通知审批侧（`purchase_submitted`）。
2. 审批通过：通知申请人可以采购并补发票（`purchase_approved`）。
3. 提交报销：通知财务进入待办（`reimbursement_submitted`）。
4. 财务打款：通知申请人流程完成（`purchase_paid`）。

代码入口：

- `src/lib/notify/wecom.ts`
- `src/lib/notify/index.ts`
- `src/app/api/purchases/[id]/workflow-handler.ts`

## 3. 环境变量配置

在 `.env.local` 增加：

```dotenv
WECOM_NOTIFY_ENABLED="1"
WECOM_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxx"

# 可选：按角色分通道，若配置则优先使用
WECOM_WEBHOOK_APPROVAL_URL=""
WECOM_WEBHOOK_APPLICANT_URL=""
WECOM_WEBHOOK_FINANCE_URL=""

# 可选：企业微信应用消息（精准推送）
WECOM_CORP_ID=""
WECOM_AGENT_ID=""
WECOM_SECRET=""

APP_BASE_URL="http://localhost:3000"
```

说明：

1. 只配 `WECOM_WEBHOOK_URL` 也能工作（群机器人模式）。
2. 若配置 `WECOM_CORP_ID/WECOM_AGENT_ID/WECOM_SECRET`，系统会优先走应用消息精准推送。
3. 应用消息推送目标来自 `hr_employees.wecom_user_id`，未绑定时会回退 webhook。
4. 分通道 webhook 可用于把不同通知发到不同群。
5. `APP_BASE_URL` 用于拼接通知详情页链接。

## 4. 员工绑定企业微信账号（关键）

你需要给员工绑定企业微信 UserId（通讯录里的 userid）：

1. 进入「组织架构 -> 员工管理 -> 新增/编辑员工」。
2. 填写字段「企业微信账号」。
3. 保存后，该员工会收到针对性的企业微信应用消息。

如果你想临时批量修复，也可以直接 SQL：

```sql
UPDATE hr_employees
SET wecom_user_id = 'zhangsan'
WHERE email = 'zhangsan@example.com';
```

## 5. 流程状态说明（采购 + 报销）

采购主状态：`draft -> pending_approval -> approved -> paid`

报销子状态（`purchases.reimbursement_status`）：

1. `none`: 未进入报销流程。
2. `invoice_pending`: 审批通过，等待申请人补发票并提交报销。
3. `reimbursement_pending`: 已提交报销，等待财务处理。
4. `reimbursement_rejected`: 预留状态，后续可扩展财务驳回。
5. `reimbursed`: 打款完成。

## 6. 关键 API 动作

1. 提交采购：`action=submit`
2. 审批通过：`action=approve`
3. 提交报销：`action=submit_reimbursement`
4. 财务打款：`action=pay`

## 7. 移动端入口（已接入）

可直接用于企业微信消息点击后的轻量处理：

1. `/m/tasks`：待办任务（待审批 + 待财务确认）。
2. `/m/tasks/:id`：单据详情与动作（同意/驳回/提交报销/确认打款）。
3. `/m/history`：我的历史申请。
4. `/m/notifications`：通知摘要。

## 8. 开发制作步骤（你可以按这个做二开）

1. 在企业微信创建应用（拿到 `CorpID`、`AgentId`、`Secret`），同时可选创建群机器人（webhook 兜底）。
2. 配置 `.env.local` 中 `WECOM_*` 变量并开启 `WECOM_NOTIFY_ENABLED=1`。
3. 给员工绑定 `wecom_user_id`（员工表单里填“企业微信账号”）。
4. 本地跑通流程：提交采购 -> 审批通过 -> 提交报销 -> 打款完成。
5. 在 `src/lib/notify/index.ts` 新增/调整通知模板文案。
6. 在 `src/app/api/purchases/[id]/workflow-handler.ts` 中扩展新的流程动作和触发点。
7. 在 `/m/*` 页面中仅保留高频动作，不放复杂录入。

## 9. 进阶企业微信能力（后续可加）

1. OAuth2 企业微信登录（用户身份与 `hr_employees` 映射）。
2. 短时效签名链接（消息直达，不依赖已有浏览器会话）。
3. 模板卡片消息 + 回调按钮（直接在企业微信内审批）。
4. 回调接口签名校验与来源 IP 白名单。

## 10. 本地验证

1. 启动项目：`npm run dev`
2. 提交采购单（无需发票）确认审批通知是否到群。
3. 在企业微信点击通知，进入 `/m/tasks/:id`。
4. 审批通过后确认申请人通知。
5. 上传发票并点击“提交报销”，确认财务通知。
6. 财务打款，确认申请人收到完成通知。
