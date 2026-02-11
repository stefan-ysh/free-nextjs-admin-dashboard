<div align="center">

# admin_cosmorigin

Localized finance + procurement workspace built on **Next.js 16**, **React 19**, and **Tailwind CSS v4**. All business data lives in your own MySQL instance and every attachment is persisted to the local filesystem—no Vercel KV / Blob dependencies.

</div>

> Originally derived from the TailAdmin template, now fully repurposed for self-hosted enterprise finance operations.

## Current Scope (Dec 2025)

Only the modules shown in the sidebar screenshots are considered production-ready right now:

- **仪表盘**: KPI snapshot rendered from local data.
- **财务管理**: Income/expense ledger, attachments written to `LOCAL_STORAGE_ROOT`.
- **采购管理**: Procurement ledger plus the dedicated approvals workbench.
- **供应商管理**: CRUD over suppliers with default marketplace seeds.
- **进销存**: Overview, product catalog, warehouse registry, and inventory movement log.
- **组织架构**: Employee and department management (shares MySQL auth tables).

Everything else from the original template remains parked for later iterations. Keep unfinished routes hidden behind feature flags or permissions when deploying.

## Inventory Operational Mode

- 商品管理入口已临时隐藏，当前库存作业聚焦`入库 / 出库`流程。
- 仓库已固定为两类：`学校`（code: `SCHOOL`）与`单位`（code: `COMPANY`）。
- API `GET /api/inventory/warehouses` 会自动校正并只返回这两类仓库。

## Procurement + Reimbursement Flow

Current workflow is now:

`采购申请 -> 管理员审批 -> 通知申请人可采购 -> 申请人补发票并提交报销 -> 财务打款 -> 通知申请人`

Key rules:

- 提交采购时不再强制上传发票。
- 审批通过后会进入报销状态 `invoice_pending`（待补发票）。
- 申请人提交报销后，状态进入 `reimbursement_pending`，财务队列才可见。
- 财务打款完成后，采购状态 `paid`，报销状态 `reimbursed`。

## Tech Stack

- Next.js 16 App Router · React 19 · TypeScript
- Tailwind CSS v4 + Radix UI + TanStack Table
- MySQL (`mysql2/promise`) with zero-ORM DAOs
- Local file store via `src/lib/storage/local.ts`

## Getting Started

```bash
git clone https://github.com/stefan-ysh/free-nextjs-admin-dashboard.git admin_cosmorigin
cd admin_cosmorigin
npm install
```

1. **Provision MySQL**
   ```bash
   mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS admin_cosmorigin CHARACTER SET utf8mb4;"
   ```
2. **Configure environment** – create `.env.local` manually and set either `MYSQL_URL` or the individual `MYSQL_*` vars plus, optionally, `LOCAL_STORAGE_ROOT`.
   ```dotenv
   MYSQL_URL="mysql://root:password@127.0.0.1:3306/admin_cosmorigin"
   # or split credentials
   # MYSQL_HOST="127.0.0.1"
   # MYSQL_PORT="3306"
   # MYSQL_USER="root"
   # MYSQL_PASSWORD="password"
   # MYSQL_DATABASE="admin_cosmorigin"
   LOCAL_STORAGE_ROOT="/Users/you/Documents/admin_cosmorigin-storage"
   ```
3. **Seed an administrator (optional)**
   ```bash
   npm run seed:admin -- admin@example.com SuperSecurePass finance_admin
   ```
4. **Run the dev server**
   ```bash
   npm run dev
   ```

Visit `http://localhost:3000/finance` or `/purchases/approvals` to verify the scoped modules.

## Form Drawer Width Standard

To keep all business forms readable on desktop and mobile, form drawers now share three width presets:

- `FORM_DRAWER_WIDTH_COMPACT`: `w-full sm:max-w-2xl`
- `FORM_DRAWER_WIDTH_STANDARD`: `w-full sm:max-w-3xl lg:max-w-4xl`
- `FORM_DRAWER_WIDTH_WIDE`: `w-full sm:max-w-4xl xl:max-w-5xl`

Source: `src/components/common/form-drawer-width.ts`.
Apply these constants to all new form drawers instead of hard-coded `sm:max-w-*` strings.

## Environment Defaults

| Variable | Default | Notes |
| --- | --- | --- |
| `MYSQL_URL` | _unset_ | Prefer `mysql://user:pass@host:3306/admin_cosmorigin` for simplicity. |
| `LOCAL_STORAGE_ROOT` | `~/Documents/admin_cosmorigin-storage` | All avatars + finance files land here. |
| `UPLOAD_MAX_BYTES` | `5 MB` | Override if you need larger invoices. |
| `SMS_NOTIFY_ENABLED` | `0` | `1` 时启用短信通知。 |
| `NOTIFY_POLICY_JSON` | _unset_ | 通知策略 JSON（按事件配置启用和通道）。 |
| `SMS_WEBHOOK_URL` | _unset_ | 短信网关 webhook（主通道）。 |
| `SMS_WEBHOOK_APPROVAL_URL` | _unset_ | 审批通知专用 webhook（可选）。 |
| `SMS_WEBHOOK_APPLICANT_URL` | _unset_ | 申请人通知专用 webhook（可选）。 |
| `SMS_WEBHOOK_FINANCE_URL` | _unset_ | 财务通知专用 webhook（可选）。 |
| `SMS_WEBHOOK_TOKEN` | _unset_ | 短信网关 Bearer Token（可选）。 |
| `SMS_FALLBACK_PHONES` | _unset_ | 默认回退手机号（逗号分隔，可选）。 |
| `SMS_FALLBACK_APPROVAL_PHONES` | _unset_ | 审批通知回退手机号（可选）。 |
| `SMS_FALLBACK_APPLICANT_PHONES` | _unset_ | 申请人通知回退手机号（可选）。 |
| `SMS_FALLBACK_FINANCE_PHONES` | _unset_ | 财务通知回退手机号（可选）。 |
| `APP_BASE_URL` | `http://localhost:3000` | 用于通知消息中的详情链接。 |

短信通知会优先使用员工手机号 `hr_employees.phone` 做精准触达；若找不到手机号则回退到配置的 `SMS_FALLBACK_*` 号码组。

`NOTIFY_POLICY_JSON` 示例：

```json
{
  "purchase_submitted": { "enabled": true, "channels": ["sms", "in_app"] },
  "purchase_approved": { "enabled": true, "channels": ["sms", "in_app"] },
  "reimbursement_submitted": { "enabled": true, "channels": ["sms", "in_app"] },
  "purchase_paid": { "enabled": true, "channels": ["sms", "in_app"] }
}
```

当通道包含 `in_app` 时，系统会把通知写入 `app_notifications`，移动端通知页 `/m/notifications` 读取该表展示。

The helper `src/lib/mysql.ts` derives a connection pool from either `MYSQL_URL` or individual host credentials, with the new default database name baked in.

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js in development mode. |
| `npm run build && npm run start` | Production build + serve. |
| `npm run lint` | ESLint via the Next.js config. |
| `npm run seed:admin -- <email> <password> [role]` | Bootstrap an auth user with MySQL-backed credentials. |
| `npm run import:finance` | Import the sample Excel ledger. |
| `npm run import:employees` | Bulk load employee CSV records. |
| `npm run migrate:finance-categories` | Sync updated finance categories. |

## Documentation Map

- `docs/FINANCE_MODULE.md` – finance form/table specs
- `docs/FINANCE_UI_UPDATE.md` – UI diff notes
- `docs/INVENTORY_MODULE.md` – scope + schema for inventory
- `docs/LOCAL_STORAGE_SETUP.md` – filesystem layout + permissions
- `docs/DEPLOYMENT.md` – systemd / Docker compose samples
- `docs/TEST_CHECKLIST.md` – end-to-end manual validation checklist
- `docs/PROCUREMENT_SYSTEM_MASTER_LIST.md` – requirement traceability and delivery status
- `docs/purchase-workflow-plan.md` – role-based procurement workflow plan and live progress checklist
- `docs/SMS_INTEGRATION.md` – 短信网关接入与联调指南
- `README.zh-CN.md` – Chinese quick start

## Future Work

- Reactivate CRM/contract modules once procurement & finance harden.
- Replace base64 upload shim with streaming multipart endpoints.
- Add CSRF middleware described in `docs/SECURITY.md`.

## License

MIT. Attributions to TailAdmin remain in the commit history; any upstream assets retain their original license.
