import { schemaPool, safeCreateIndex, ensureColumn } from '@/lib/schema/mysql-utils';
import { ensureUsersSchema } from '@/lib/schema/users';
import { ensureProjectsSchema } from '@/lib/schema/projects';
import { ensureSuppliersSchema } from '@/lib/schema/suppliers';

let initialized = false;

export async function ensurePurchasesSchema() {
  if (initialized) return;

  await ensureUsersSchema();
  await ensureProjectsSchema();
  await ensureSuppliersSchema();

  const pool = schemaPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id CHAR(36) NOT NULL PRIMARY KEY,
      purchase_number VARCHAR(40) NOT NULL UNIQUE,
      purchase_date DATE NOT NULL,
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
      supplier_id CHAR(36),
      invoice_type ENUM('special','general','none') NOT NULL,
      invoice_status ENUM('pending','issued','not_required') NOT NULL DEFAULT 'not_required',
      invoice_number VARCHAR(120),
      invoice_issue_date DATE,
      invoice_images JSON NOT NULL DEFAULT (JSON_ARRAY()),
      receipt_images JSON NOT NULL DEFAULT (JSON_ARRAY()),
      has_project TINYINT(1) NOT NULL DEFAULT 0,
      project_id CHAR(36),
      status ENUM('draft','pending_approval','approved','rejected','paid','cancelled') NOT NULL DEFAULT 'draft',
      submitted_at DATETIME(3),
      approved_at DATETIME(3),
      approved_by CHAR(36),
      rejected_at DATETIME(3),
      rejected_by CHAR(36),
      rejection_reason TEXT,
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
      CONSTRAINT fk_purchases_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchases_approved_by FOREIGN KEY (approved_by) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchases_rejected_by FOREIGN KEY (rejected_by) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchases_paid_by FOREIGN KEY (paid_by) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Ensure newer columns exist for legacy databases
  await ensureColumn('purchases', 'fee_amount', "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await ensureColumn(
    'purchases',
    'payment_type',
    "ENUM('deposit','full','installment','balance','other') NOT NULL DEFAULT 'full'"
  );
  await ensureColumn('purchases', 'payment_channel', 'VARCHAR(120)');
  await ensureColumn('purchases', 'payer_name', 'VARCHAR(120)');
  await ensureColumn('purchases', 'transaction_no', 'VARCHAR(160)');
  await ensureColumn('purchases', 'supplier_id', 'CHAR(36) NULL');
  await ensureColumn(
    'purchases',
    'invoice_status',
    "ENUM('pending','issued','not_required') NOT NULL DEFAULT 'not_required'"
  );
  await ensureColumn('purchases', 'invoice_number', 'VARCHAR(120)');
  await ensureColumn('purchases', 'invoice_issue_date', 'DATE');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reimbursement_logs (
      id CHAR(36) NOT NULL PRIMARY KEY,
      purchase_id CHAR(36) NOT NULL,
      action ENUM('submit','approve','reject','pay','cancel','withdraw') NOT NULL,
      from_status ENUM('draft','pending_approval','approved','rejected','paid','cancelled') NOT NULL,
      to_status ENUM('draft','pending_approval','approved','rejected','paid','cancelled') NOT NULL,
      operator_id CHAR(36) NOT NULL,
      comment TEXT,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_reimbursement_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      CONSTRAINT fk_reimbursement_operator FOREIGN KEY (operator_id) REFERENCES hr_employees(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeCreateIndex('CREATE INDEX idx_purchases_number ON purchases(purchase_number)');
  await safeCreateIndex('CREATE INDEX idx_purchases_purchaser ON purchases(purchaser_id)');
  await safeCreateIndex('CREATE INDEX idx_purchases_status ON purchases(status)');
  await safeCreateIndex('CREATE INDEX idx_purchases_project ON purchases(project_id)');
  await safeCreateIndex('CREATE INDEX idx_purchases_date ON purchases(purchase_date)');
  await safeCreateIndex('CREATE INDEX idx_purchases_created_by ON purchases(created_by)');
  await safeCreateIndex('CREATE INDEX idx_purchases_supplier ON purchases(supplier_id)');
  await safeCreateIndex('CREATE INDEX idx_reimbursement_logs_purchase ON reimbursement_logs(purchase_id)');
  await safeCreateIndex('CREATE INDEX idx_reimbursement_logs_created ON reimbursement_logs(created_at)');

  initialized = true;
}
