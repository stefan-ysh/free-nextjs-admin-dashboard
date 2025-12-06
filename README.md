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
cp .env.example .env.local
```

1. **Provision MySQL**
   ```bash
   mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS admin_cosmorigin CHARACTER SET utf8mb4;"
   ```
2. **Configure environment** – set either `MYSQL_URL` or the individual `MYSQL_*` vars plus, optionally, `LOCAL_STORAGE_ROOT`.
3. **Seed an administrator (optional)**
   ```bash
   npm run seed:admin -- admin@example.com SuperSecurePass finance_admin
   ```
4. **Run the dev server**
   ```bash
   npm run dev
   ```

Visit `http://localhost:3000/finance` or `/purchases/approvals` to verify the scoped modules.

## Environment Defaults

| Variable | Default | Notes |
| --- | --- | --- |
| `MYSQL_URL` | _unset_ | Prefer `mysql://user:pass@host:3306/admin_cosmorigin` for simplicity. |
| `LOCAL_STORAGE_ROOT` | `~/Documents/admin_cosmorigin-storage` | All avatars + finance files land here. |
| `UPLOAD_MAX_BYTES` | `5 MB` | Override if you need larger invoices. |

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
- `README.zh-CN.md` – Chinese quick start

## Future Work

- Reactivate CRM/contract modules once procurement & finance harden.
- Replace base64 upload shim with streaming multipart endpoints.
- Add CSRF middleware described in `docs/SECURITY.md`.

## License

MIT. Attributions to TailAdmin remain in the commit history; any upstream assets retain their original license.
