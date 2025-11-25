import { schemaPool, safeCreateIndex } from '@/lib/schema/mysql-utils';
import { ensureProjectsSchema } from '@/lib/schema/projects';

let initialized = false;

export async function ensureProjectPaymentsSchema() {
  if (initialized) return;

  await ensureProjectsSchema();
  const pool = schemaPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_payments (
      id CHAR(36) NOT NULL PRIMARY KEY,
      project_id CHAR(36) NOT NULL,
      milestone_id VARCHAR(64) NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      amount DECIMAL(15,2) NOT NULL,
      expected_date DATE NOT NULL,
      received_date DATE NULL,
      status ENUM('scheduled','invoiced','received','cancelled') NOT NULL DEFAULT 'scheduled',
      invoice_type ENUM('special','general','none') NOT NULL DEFAULT 'none',
      invoice_number VARCHAR(120) NULL,
      invoice_issue_date DATE NULL,
      invoice_attachments JSON NOT NULL DEFAULT (JSON_ARRAY()),
      notes TEXT NULL,
      metadata JSON NULL,
      created_by CHAR(36) NOT NULL,
      updated_by CHAR(36) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_project_payments_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeCreateIndex('CREATE INDEX idx_project_payments_project ON project_payments(project_id)');
  await safeCreateIndex('CREATE INDEX idx_project_payments_status ON project_payments(status)');
  await safeCreateIndex('CREATE INDEX idx_project_payments_expected_date ON project_payments(expected_date)');

  initialized = true;
}
