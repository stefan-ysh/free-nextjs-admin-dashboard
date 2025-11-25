# Data Model & API Map

This document inventories the current MySQL schemas under `src/lib/schema` and the related API routes in `src/app/api`. Use it as a reference when extending project / finance / procurement flows.

## 1. Persistence Overview

- **Database access layer**: raw MySQL queries via `mysql2`, wrapped by helpers in `src/lib/mysql.ts` and DAO files in `src/lib/db/*` (e.g. `projects.ts`, `purchases.ts`, `finance.ts`). Every DAO calls an `ensure*Schema()` guard before executing queries.
- **ID strategy**: most business tables store `CHAR(36)` UUIDs; some inventory tables use shorter string IDs. Finance records additionally allow custom string IDs.
- **JSON fields**: attachments, tags, address blocks, member lists, etc., are stored as JSON columns (ensure client code handles parsing failures gracefully).
- **Soft deletes**: major entities (`projects`, `purchases`, `clients`) include `is_deleted` + `deleted_at`. APIs filter deleted rows unless `includeDeleted` is provided.
- **Files**: binary payloads are saved under `public/uploads/*` via `src/lib/storage/local.ts`. `/api/files/upload` handles uploads; `/api/files/[...segments]` streams the stored file for preview/download.

## 2. Entity Details

### 2.1 Users & HR
- `users`: authentication profile plus employment metadata (role array, manager, department, status flags). Self-referencing foreign keys (`manager_id`, `created_by`).
- `hr_departments`, `hr_job_grades`: hierarchical department tree and grading catalog.
- `hr_employees`: mirrors `users` and links via `user_id`, referencing department / job grade. Tracks employment status, dates, manager, and custom fields.
- `hr_employee_status_logs`: immutable audit trail for employment status transitions.

### 2.2 Clients
- `clients`: supports personal/company types, billing & shipping addresses, payment terms, owner, tags, and lifecycle status.
- `client_contacts`: multiple contacts per client with `is_primary` flag.
- `client_logs`: timeline of interactions (create, update, follow-up, payments, status changes); references both client and operator.

### 2.3 Projects
- `projects`: core project metadata (code, name, description, client, contract data, currency/tax, milestones JSON). Links to `users` via `project_manager_id`, `created_by`, and `team_member_ids` (JSON array of user IDs). Status + priority enums, soft-delete columns.

### 2.4 Purchases & Reimbursements
- `purchases`: procurement + reimbursement workflow. Includes product info, payment channel/type, invoice metadata, attachment arrays, `has_project` + `project_id`, workflow timestamps (`submitted_at`, `approved_at`, `paid_at`), and status enum (`draft`→`pending_approval`→`approved`/`rejected`→`paid`/`cancelled`). Tracks approver / payer references back to `users`.
- `reimbursement_logs`: immutable history of reimbursement actions with operator reference.

### 2.5 Finance
- `finance_records`: normalized ledger storing both income and expenses. Core fields: `type`, `category`, `date_value`, amounts (`contract_amount`, `fee`, `total_amount`, `quantity`), payment info, attachments (invoice JSON, tags), provenance (`source_type` + optional `purchase_id` / `project_id` foreign keys). Indexes on date, type, category, and cross-module references.
- `finance_categories`: seeded lookup table per `TransactionType`, with `is_default` flag.

### 2.6 Inventory
- `inventory_items`: stock catalog (SKU, name, unit, cost/price, spec fields, attribute blobs).
- `inventory_warehouses`: warehouse registry with capacity, type, manager.
- `inventory_stock_snapshots`: per-item-per-warehouse quantity + reserved amount.
- `inventory_movements`: inbound/outbound transactions (purchase, transfer, sale, adjust, return) carrying unit cost, amount, attachments, operator, `related_order_id` for traceability.
- `inventory_alerts`: low-stock notifications referencing item + optional warehouse.

### 2.7 Calendar
- `calendar_events`: shared event table (meeting/deadline/reminder/travel) with all-day flag and metadata JSON.

## 3. API Surface (selected routes)

Each route resides under `src/app/api/<module>`. Permissions are enforced via `requireCurrentUser`, `toPermissionUser`, and `Permissions` constants.

### 3.1 Projects (`/api/projects`)
| Route | Method | Description | Data Touchpoints |
| --- | --- | --- | --- |
| `/api/projects` | GET | List + filter projects (status, priority, manager, search, pagination). Users without `PROJECT_VIEW_ALL` receive only their own/team projects. | Reads `projects`, `users` (team membership).
| `/api/projects` | POST | Create project via validated payload (`validators.ts`). Ensures unique project/contract codes and valid manager. | Writes `projects`, references `users`.
| `/api/projects/[id]` | GET | Fetch detail; allowed for admins or team members. | Reads `projects`.
| `/api/projects/[id]` | PATCH | Update editable fields; same permission gate; enforces data integrity. | Writes `projects`.
| `/api/projects/[id]` | DELETE | Soft-delete (via DAO) when `PROJECT_DELETE` allowed. | Updates `projects`.
| `/api/projects/clients` | GET | Client dropdown data (see DAO). | Joins `clients`.
| `/api/projects/stats/*` | GET | Summary metrics (pipeline, revenue, etc.). | Aggregates `projects`.

### 3.2 Purchases (`/api/purchases`)
| Route | Method | Description | Data Touchpoints |
| --- | --- | --- | --- |
| `/api/purchases` | GET | Filter list (status, purchaser, project, amount, date, channel, payment method). Non-admins restricted to their submissions. | Reads `purchases`.
| `/api/purchases` | POST | Create purchase (validates channel-specific fields, payment type, optional project binding). | Writes `purchases`, may call `findProjectById`.
| `/api/purchases/[id]` | GET | Detailed view with approvals, attachments, purchaser profile. | Reads `purchases`, `users`.
| `/api/purchases/[id]` | PATCH | Update editable fields + workflow transitions when `canEditPurchase` passes. | Writes `purchases`, `reimbursement_logs`.
| `/api/purchases/[id]` | DELETE | Soft-delete pending purchases if `canDeletePurchase` allows. | Updates `purchases`.
| `/api/purchases/stats/*` | GET | Aggregations for dashboards. | Aggregates `purchases`.
| `/api/purchases/export` | POST | Generate export (CSV/XLSX). | Reads `purchases` + joins.

*Workflow hook*: reimbursement logs are appended on state changes; future enhancement can trigger finance record creation when status changes to `paid`.

### 3.3 Finance (`/api/finance`)
| Route | Method | Description | Data Touchpoints |
| --- | --- | --- | --- |
| `/api/finance/records` | GET | Admin-only ledger listing with date/type/category filters, pagination, and keyword search. | Reads `finance_records`.
| `/api/finance/records` | POST | Create record (manual entry or system-sourced). Applies schema validation, auto-generates transaction number, stores attachments via `saveBase64File`. | Writes `finance_records`, `files` storage.
| `/api/finance/categories` | GET/POST | Manage ledger categories. | Reads/Writes `finance_categories`.
| `/api/finance/stats/*` | GET | Aggregate metrics (cash-flow, trends). | Aggregates `finance_records`.

### 3.4 Inventory (`/api/inventory`)
| Items routes | GET/POST for catalog maintenance (`inventory_items`). |
| `/inventory/warehouses` | GET/POST to manage warehouses. |
| `/inventory/inbound` & `/inventory/outbound` | POST to record stock movements tied to purchases, transfers, sales, or adjustments. |
| `/inventory/movements` | GET for history timeline (filters by direction/type/item). |
| `/inventory/stats` | GET for stock/alert summaries. |

### 3.5 Clients (`/api/clients`)
CRUD operations plus `validators.ts` to enforce required billing info. Contacts and logs are managed via nested DAO functions.

### 3.6 Employees & HR (`/api/employees`, `/api/hr`)
Endpoints cover employee list/detail, department tree, job grades, import/export CSV flows, and auto-binding between `users` and `hr_employees`.

### 3.7 Files & Attachments
`/api/files/upload` accepts multipart file uploads (5 MB limit) and returns a URL pointing to `/api/files/[...segments]` for subsequent preview/download. Attachments stored in purchases, finance, and projects reuse this infrastructure.

## 4. Cross-Module Relationships & Considerations

1. **User & Permission graph**: `users` drive both HR data and authorization decisions. Keep `roles` JSON synced with `primary_role`; APIs often downgrade access if `checkPermission` fails.
2. **Projects ↔ Purchases ↔ Finance**:
   - Purchases optionally bind to a project (`has_project`, `project_id`). When approved/paid, a finance record can be auto-created by calling `createRecord({ sourceType: 'purchase', purchaseId })`.
   - Finance records already reserve foreign keys for purchases/projects; ensure downstream reports use these joins for drill-downs.
3. **Inventory ↔ Purchases**: current schema seeds inventory independently, but inbound purchase movements can be reconciled by correlating `purchases.purchase_number` with `inventory_movements.related_order_id`.
4. **Attachments & previews**: All modules store attachment URLs (JSON arrays). Implement preview UI by using `/api/files/[...segments]` and MIME inference from the backend route.
5. **Soft delete & auditing**: Many tables rely on `is_deleted` flags rather than cascading deletes. APIs default to filtering these rows; administrative tooling should expose restore options if necessary.
6. **Data validation**: `src/lib/validations` contains Zod schemas (e.g., `financeRecordSchema`), while purchases & projects use custom parsers in their API folders.

## 5. Suggested Next Steps

1. **ER Diagram**: Generate from the schema definitions (e.g., using dbdiagram.io) to visualize relationships mentioned above.
2. **Automated migrations**: Consider codifying schema evolution using a migration tool (Prisma, Drizzle, or PlanetScale migrations) instead of ad-hoc `ensureColumn` calls.
3. **Event hooks**: Define service-layer hooks so that purchase status transitions automatically invoke finance record creation and inventory movements.
4. **API typing**: Share DTO contracts between frontend and backend by exporting request/response types from `src/types/*`, reducing duplication.

This document should evolve alongside schema or API updates—update the relevant sections whenever a new table or route is introduced.
