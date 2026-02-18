import { schemaPool, safeCreateIndex, ensureColumn } from '@/lib/schema/mysql-utils';
import { ensureUsersSchema } from '@/lib/schema/users';

let initialized = false;

async function dropForeignKeyIfExists(table: string, constraint: string) {
  const pool = schemaPool();
  const [rows] = (await pool.query(
    `
      SELECT COUNT(*) AS exists_count
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    `,
    [table, constraint]
  )) as [Array<{ exists_count: number }>, unknown];
  if (Number(rows?.[0]?.exists_count ?? 0) > 0) {
    await pool.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${constraint}\``);
  }
}

async function dropIndexIfExists(table: string, index: string) {
  const pool = schemaPool();
  const [rows] = (await pool.query(
    `
      SELECT COUNT(*) AS exists_count
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [table, index]
  )) as [Array<{ exists_count: number }>, unknown];
  if (Number(rows?.[0]?.exists_count ?? 0) > 0) {
    await pool.query(`ALTER TABLE \`${table}\` DROP INDEX \`${index}\``);
  }
}

async function dropColumnIfExists(table: string, column: string) {
  const pool = schemaPool();
  const [rows] = (await pool.query(
    `
      SELECT COUNT(*) AS exists_count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [table, column]
  )) as [Array<{ exists_count: number }>, unknown];
  if (Number(rows?.[0]?.exists_count ?? 0) > 0) {
    await pool.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
  }
}

export async function ensurePurchasesSchema() {
  if (initialized) return;

  await ensureUsersSchema();

  const pool = schemaPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id CHAR(36) NOT NULL PRIMARY KEY,
      purchase_number VARCHAR(40) NOT NULL UNIQUE,
      purchase_date DATE NOT NULL,
      organization_type ENUM('school','company') NOT NULL DEFAULT 'company',
      item_name VARCHAR(255) NOT NULL,
      specification TEXT,
      quantity DECIMAL(10,2) NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL,
      total_amount DECIMAL(15,2) NOT NULL,
      fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      purchase_channel ENUM('online','offline') NOT NULL,
      purchase_location VARCHAR(255),
      purchase_link TEXT,
      purpose TEXT NOT NULL,
      payment_method ENUM('wechat','alipay','bank_transfer','corporate_transfer','cash') NOT NULL,
      payment_type ENUM('deposit','full','installment','balance','other') NOT NULL DEFAULT 'full',
      payment_channel VARCHAR(120),
      payer_name VARCHAR(120),
      transaction_no VARCHAR(160),
      purchaser_id CHAR(36) NOT NULL,
      invoice_type ENUM('special','general','none') NOT NULL,
      invoice_status ENUM('pending','issued','not_required') NOT NULL DEFAULT 'not_required',
      invoice_number VARCHAR(120),
      invoice_issue_date DATE,
      invoice_images JSON NOT NULL DEFAULT (JSON_ARRAY()),
      receipt_images JSON NOT NULL DEFAULT (JSON_ARRAY()),
      status ENUM('draft','pending_approval','pending_inbound','approved','rejected','paid','cancelled') NOT NULL DEFAULT 'draft',
      reimbursement_status ENUM('none','invoice_pending','reimbursement_pending','reimbursement_rejected','reimbursed') NOT NULL DEFAULT 'none',
      reimbursement_submitted_at DATETIME(3),
      reimbursement_submitted_by CHAR(36),
      reimbursement_rejected_at DATETIME(3),
      reimbursement_rejected_by CHAR(36),
      reimbursement_rejected_reason TEXT,
      submitted_at DATETIME(3),
      pending_approver_id CHAR(36),
      inbound_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
      workflow_step_index INT,
      workflow_nodes JSON,
      approved_at DATETIME(3),
      approved_by CHAR(36),
      rejected_at DATETIME(3),
      rejected_by CHAR(36),
      rejection_reason TEXT,
      payment_issue_open TINYINT(1) NOT NULL DEFAULT 0,
      payment_issue_reason TEXT,
      payment_issue_at DATETIME(3),
      payment_issue_by CHAR(36),
      paid_at DATETIME(3),
      paid_by CHAR(36),
      notes TEXT,
      attachments JSON NOT NULL DEFAULT (JSON_ARRAY()),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      created_by CHAR(36) NOT NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      deleted_at DATETIME(3),
      CONSTRAINT chk_purchases_quantity CHECK (quantity > 0),
      CONSTRAINT chk_purchases_unit_price CHECK (unit_price >= 0),
      CONSTRAINT chk_purchases_total CHECK (total_amount >= 0),
      CONSTRAINT chk_purchases_fee CHECK (fee_amount >= 0),
      CONSTRAINT chk_purchases_total_consistency CHECK (ABS(total_amount - (quantity * unit_price)) <= 0.01),
      CONSTRAINT fk_purchases_purchaser FOREIGN KEY (purchaser_id) REFERENCES hr_employees(id) ON DELETE RESTRICT,
      CONSTRAINT fk_purchases_created_by FOREIGN KEY (created_by) REFERENCES hr_employees(id) ON DELETE RESTRICT,
      CONSTRAINT fk_purchases_pending_approver FOREIGN KEY (pending_approver_id) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchases_reimbursement_submitted_by FOREIGN KEY (reimbursement_submitted_by) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchases_reimbursement_rejected_by FOREIGN KEY (reimbursement_rejected_by) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchases_approved_by FOREIGN KEY (approved_by) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchases_rejected_by FOREIGN KEY (rejected_by) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchases_payment_issue_by FOREIGN KEY (payment_issue_by) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchases_paid_by FOREIGN KEY (paid_by) REFERENCES hr_employees(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Ensure newer columns exist for legacy databases
  await ensureColumn('purchases', 'fee_amount', "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await ensureColumn(
    'purchases',
    'organization_type',
    "ENUM('school','company') NOT NULL DEFAULT 'company'"
  );
  await ensureColumn(
    'purchases',
    'payment_type',
    "ENUM('deposit','full','installment','balance','other') NOT NULL DEFAULT 'full'"
  );
  await ensureColumn('purchases', 'payment_channel', 'VARCHAR(120)');
  await ensureColumn('purchases', 'payer_name', 'VARCHAR(120)');
  await ensureColumn('purchases', 'transaction_no', 'VARCHAR(160)');
  await ensureColumn(
    'purchases',
    'invoice_status',
    "ENUM('pending','issued','not_required') NOT NULL DEFAULT 'not_required'"
  );
  await ensureColumn('purchases', 'invoice_number', 'VARCHAR(120)');
  await ensureColumn('purchases', 'invoice_issue_date', 'DATE');
  await ensureColumn('purchases', 'pending_approver_id', 'CHAR(36) NULL');
  await ensureColumn('purchases', 'inbound_quantity', 'DECIMAL(10,2) NOT NULL DEFAULT 0');
  await pool.query(
    "ALTER TABLE purchases MODIFY COLUMN status ENUM('draft','pending_approval','pending_inbound','approved','rejected','paid','cancelled') NOT NULL DEFAULT 'draft'"
  );
  await ensureColumn(
    'purchases',
    'reimbursement_status',
    "ENUM('none','invoice_pending','reimbursement_pending','reimbursement_rejected','reimbursed') NOT NULL DEFAULT 'none'"
  );
  await ensureColumn('purchases', 'reimbursement_submitted_at', 'DATETIME(3) NULL');
  await ensureColumn('purchases', 'reimbursement_submitted_by', 'CHAR(36) NULL');
  await ensureColumn('purchases', 'reimbursement_rejected_at', 'DATETIME(3) NULL');
  await ensureColumn('purchases', 'reimbursement_rejected_by', 'CHAR(36) NULL');
  await ensureColumn('purchases', 'reimbursement_rejected_reason', 'TEXT NULL');
  await pool.query(`
    UPDATE purchases
    SET reimbursement_status = CASE
      WHEN status = 'paid' THEN 'reimbursed'
      WHEN status IN ('pending_inbound','approved') THEN 'invoice_pending'
      ELSE reimbursement_status
    END
    WHERE reimbursement_status = 'none'
      AND status IN ('pending_inbound', 'approved', 'paid')
  `);
  await ensureColumn('purchases', 'workflow_step_index', 'INT NULL');
  await ensureColumn('purchases', 'workflow_nodes', 'JSON NULL');
  await ensureColumn('purchases', 'payment_issue_open', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('purchases', 'payment_issue_reason', 'TEXT NULL');
  await ensureColumn('purchases', 'payment_issue_at', 'DATETIME(3) NULL');
  await ensureColumn('purchases', 'payment_issue_at', 'DATETIME(3) NULL');
  await ensureColumn('purchases', 'payment_issue_by', 'CHAR(36) NULL');
  await ensureColumn('purchases', 'inventory_item_id', 'CHAR(36) NULL');
  await dropForeignKeyIfExists('purchases', 'fk_purchases_supplier');
  await dropIndexIfExists('purchases', 'idx_purchases_supplier');
  await dropColumnIfExists('purchases', 'supplier_id');
  await dropForeignKeyIfExists('purchases', 'fk_purchases_project');
  await dropIndexIfExists('purchases', 'idx_purchases_project');
  await dropColumnIfExists('purchases', 'has_project');
  await dropColumnIfExists('purchases', 'project_id');
  await dropForeignKeyIfExists('finance_records', 'fk_finance_supplier');
  await dropIndexIfExists('finance_records', 'idx_finance_supplier');
  await dropColumnIfExists('finance_records', 'supplier_id');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reimbursement_logs (
      id CHAR(36) NOT NULL PRIMARY KEY,
      purchase_id CHAR(36) NOT NULL,
      action ENUM('submit','approve','reject','pay','cancel','withdraw','transfer','issue','resolve') NOT NULL,
      from_status ENUM('draft','pending_approval','pending_inbound','approved','rejected','paid','cancelled') NOT NULL,
      to_status ENUM('draft','pending_approval','pending_inbound','approved','rejected','paid','cancelled') NOT NULL,
      operator_id CHAR(36) NOT NULL,
      comment TEXT,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_reimbursement_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      CONSTRAINT fk_reimbursement_operator FOREIGN KEY (operator_id) REFERENCES hr_employees(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(
    "ALTER TABLE reimbursement_logs MODIFY COLUMN action ENUM('submit','approve','reject','pay','cancel','withdraw','transfer','issue','resolve') NOT NULL"
  );
  await pool.query(
    "ALTER TABLE reimbursement_logs MODIFY COLUMN from_status ENUM('draft','pending_approval','pending_inbound','approved','rejected','paid','cancelled') NOT NULL"
  );
  await pool.query(
    "ALTER TABLE reimbursement_logs MODIFY COLUMN to_status ENUM('draft','pending_approval','pending_inbound','approved','rejected','paid','cancelled') NOT NULL"
  );

  await safeCreateIndex('CREATE INDEX idx_purchases_number ON purchases(purchase_number)');
  await safeCreateIndex('CREATE INDEX idx_purchases_purchaser ON purchases(purchaser_id)');
  await safeCreateIndex('CREATE INDEX idx_purchases_status ON purchases(status)');
  await safeCreateIndex('CREATE INDEX idx_purchases_reimbursement_status ON purchases(reimbursement_status)');
  await safeCreateIndex('CREATE INDEX idx_purchases_date ON purchases(purchase_date)');
  await safeCreateIndex('CREATE INDEX idx_purchases_created_by ON purchases(created_by)');
  await safeCreateIndex('CREATE INDEX idx_reimbursement_logs_purchase ON reimbursement_logs(purchase_id)');
  await safeCreateIndex('CREATE INDEX idx_reimbursement_logs_created ON reimbursement_logs(created_at)');
  // Hard-delete deprecated supplier module tables.
  await pool.query('DROP TABLE IF EXISTS supplier_bank_accounts');
  await pool.query('DROP TABLE IF EXISTS supplier_contacts');
  await pool.query('DROP TABLE IF EXISTS suppliers');
  await dropForeignKeyIfExists('finance_records', 'fk_finance_purchase_payment');
  await dropIndexIfExists('finance_records', 'idx_finance_purchase_payment');
  await dropColumnIfExists('finance_records', 'purchase_payment_id');
  await pool.query('DROP TABLE IF EXISTS purchase_payments');
  await pool.query('DROP TABLE IF EXISTS purchase_workflow_configs');
  await pool.query('DROP TABLE IF EXISTS project_payments');
  await pool.query('DROP TABLE IF EXISTS projects');
  await pool.query('DROP TABLE IF EXISTS calendar_events');
  await pool.query('DROP TABLE IF EXISTS client_logs');
  await pool.query('DROP TABLE IF EXISTS client_contacts');
  await pool.query('DROP TABLE IF EXISTS clients');

  initialized = true;
}
