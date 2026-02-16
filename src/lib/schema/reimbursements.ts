import { safeCreateIndex, schemaPool } from '@/lib/schema/mysql-utils';
import { ensurePurchasesSchema } from '@/lib/schema/purchases';

let initialized = false;

export async function ensureReimbursementsSchema() {
  if (initialized) return;

  await ensurePurchasesSchema();
  const pool = schemaPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reimbursements (
      id CHAR(36) NOT NULL PRIMARY KEY,
      reimbursement_number VARCHAR(40) NOT NULL UNIQUE,
      source_type ENUM('purchase', 'direct') NOT NULL DEFAULT 'direct',
      source_purchase_id CHAR(36) NULL,
      organization_type ENUM('school','company') NOT NULL DEFAULT 'company',
      category VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      occurred_at DATE NOT NULL,
      description TEXT NULL,
      invoice_images JSON NOT NULL DEFAULT (JSON_ARRAY()),
      receipt_images JSON NOT NULL DEFAULT (JSON_ARRAY()),
      attachments JSON NOT NULL DEFAULT (JSON_ARRAY()),
      status ENUM('draft','pending_approval','approved','rejected','paid') NOT NULL DEFAULT 'draft',
      pending_approver_id CHAR(36) NULL,
      submitted_at DATETIME(3) NULL,
      approved_at DATETIME(3) NULL,
      approved_by CHAR(36) NULL,
      rejected_at DATETIME(3) NULL,
      rejected_by CHAR(36) NULL,
      rejection_reason TEXT NULL,
      paid_at DATETIME(3) NULL,
      paid_by CHAR(36) NULL,
      payment_note TEXT NULL,
      applicant_id CHAR(36) NOT NULL,
      created_by CHAR(36) NOT NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      deleted_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT chk_reimbursements_amount CHECK (amount > 0),
      CONSTRAINT fk_reimbursements_source_purchase FOREIGN KEY (source_purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
      CONSTRAINT fk_reimbursements_pending_approver FOREIGN KEY (pending_approver_id) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_reimbursements_approved_by FOREIGN KEY (approved_by) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_reimbursements_rejected_by FOREIGN KEY (rejected_by) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_reimbursements_paid_by FOREIGN KEY (paid_by) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_reimbursements_applicant FOREIGN KEY (applicant_id) REFERENCES hr_employees(id) ON DELETE RESTRICT,
      CONSTRAINT fk_reimbursements_created_by FOREIGN KEY (created_by) REFERENCES hr_employees(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reimbursement_workflow_logs (
      id CHAR(36) NOT NULL PRIMARY KEY,
      reimbursement_id CHAR(36) NOT NULL,
      action ENUM('create','submit','approve','reject','withdraw','pay') NOT NULL,
      from_status ENUM('draft','pending_approval','approved','rejected','paid') NOT NULL,
      to_status ENUM('draft','pending_approval','approved','rejected','paid') NOT NULL,
      operator_id CHAR(36) NOT NULL,
      comment TEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_reimbursement_logs_main FOREIGN KEY (reimbursement_id) REFERENCES reimbursements(id) ON DELETE CASCADE,
      CONSTRAINT fk_reimbursement_logs_operator FOREIGN KEY (operator_id) REFERENCES hr_employees(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeCreateIndex('CREATE INDEX idx_reimbursements_status ON reimbursements(status)');
  await safeCreateIndex('CREATE INDEX idx_reimbursements_applicant ON reimbursements(applicant_id)');
  await safeCreateIndex('CREATE INDEX idx_reimbursements_created_by ON reimbursements(created_by)');
  await safeCreateIndex('CREATE INDEX idx_reimbursements_approver ON reimbursements(pending_approver_id)');
  await safeCreateIndex('CREATE INDEX idx_reimbursements_org ON reimbursements(organization_type)');
  await safeCreateIndex('CREATE INDEX idx_reimbursements_source ON reimbursements(source_type, source_purchase_id)');
  await safeCreateIndex('CREATE INDEX idx_reimbursement_logs_main ON reimbursement_workflow_logs(reimbursement_id)');
  await safeCreateIndex('CREATE INDEX idx_reimbursement_logs_time ON reimbursement_workflow_logs(created_at)');

  initialized = true;
}
