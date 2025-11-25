import { schemaPool, safeCreateIndex, ensureColumn } from '@/lib/schema/mysql-utils';

let initialized = false;

export async function ensureProjectsSchema() {
  if (initialized) return;

  const pool = schemaPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id CHAR(36) NOT NULL PRIMARY KEY,
      project_code VARCHAR(50) NOT NULL UNIQUE,
      project_name VARCHAR(255) NOT NULL,
      description TEXT,
      client_name VARCHAR(255),
      contract_amount DECIMAL(15,2),
      budget DECIMAL(15,2),
      actual_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
      contract_number VARCHAR(100) UNIQUE,
      contract_type ENUM('service','purchase','maintenance','consulting','other'),
      signing_date DATE,
      effective_date DATE,
      expiration_date DATE,
      party_a VARCHAR(255),
      party_b VARCHAR(255),
      currency CHAR(5) NOT NULL DEFAULT 'CNY',
      tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
      payment_terms TEXT,
      risk_level ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
      attachments JSON NOT NULL DEFAULT (JSON_ARRAY()),
      milestones JSON NOT NULL DEFAULT (JSON_ARRAY()),
      start_date DATE,
      end_date DATE,
      expected_end_date DATE,
      project_manager_id CHAR(36) NOT NULL,
      team_member_ids JSON NOT NULL DEFAULT (JSON_ARRAY()),
      status ENUM('planning','active','on_hold','completed','archived','cancelled') NOT NULL DEFAULT 'planning',
      priority ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      created_by CHAR(36) NOT NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      deleted_at DATETIME(3),
      CONSTRAINT chk_projects_amounts CHECK (
        (contract_amount IS NULL OR contract_amount >= 0) AND
        (budget IS NULL OR budget >= 0) AND
        actual_cost >= 0
      ),
      CONSTRAINT fk_projects_manager FOREIGN KEY (project_manager_id) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_projects_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await ensureColumn('projects', 'contract_number', 'VARCHAR(100) NULL');
  await ensureColumn('projects', 'contract_type', "ENUM('service','purchase','maintenance','consulting','other') NULL");
  await ensureColumn('projects', 'signing_date', 'DATE NULL');
  await ensureColumn('projects', 'effective_date', 'DATE NULL');
  await ensureColumn('projects', 'expiration_date', 'DATE NULL');
  await ensureColumn('projects', 'party_a', 'VARCHAR(255) NULL');
  await ensureColumn('projects', 'party_b', 'VARCHAR(255) NULL');
  await ensureColumn('projects', 'currency', "CHAR(5) NOT NULL DEFAULT 'CNY'");
  await ensureColumn('projects', 'tax_rate', 'DECIMAL(5,2) NOT NULL DEFAULT 0');
  await ensureColumn('projects', 'payment_terms', 'TEXT NULL');
  await ensureColumn('projects', 'risk_level', "ENUM('low','medium','high') NOT NULL DEFAULT 'medium'");
  await ensureColumn('projects', 'attachments', 'JSON NOT NULL DEFAULT (JSON_ARRAY())');
  await ensureColumn('projects', 'milestones', 'JSON NOT NULL DEFAULT (JSON_ARRAY())');

  await safeCreateIndex('CREATE INDEX idx_projects_code ON projects(project_code)');
  await safeCreateIndex('CREATE INDEX idx_projects_manager ON projects(project_manager_id)');
  await safeCreateIndex('CREATE INDEX idx_projects_status ON projects(status)');
  await safeCreateIndex('CREATE INDEX idx_projects_created_by ON projects(created_by)');
  await safeCreateIndex('CREATE INDEX idx_projects_start_date ON projects(start_date)');
  await safeCreateIndex('CREATE UNIQUE INDEX idx_projects_contract_number ON projects(contract_number)');

  initialized = true;
}
