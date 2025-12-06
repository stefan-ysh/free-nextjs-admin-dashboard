import { schemaPool, safeCreateIndex } from '@/lib/schema/mysql-utils';
import { ensureUsersSchema } from '@/lib/schema/users';

let initialized = false;

export async function ensureClientsSchema() {
  if (initialized) return;

  await ensureUsersSchema();
  const pool = schemaPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id CHAR(36) NOT NULL PRIMARY KEY,
      type ENUM('personal','company') NOT NULL,
      display_name VARCHAR(160) NOT NULL,
      company_name VARCHAR(255) NULL,
      contact_person VARCHAR(120) NULL,
      mobile VARCHAR(40) NULL,
      email VARCHAR(160) NULL,
      tax_number VARCHAR(80) NULL,
      invoice_title VARCHAR(255) NULL,
      billing_address JSON NOT NULL DEFAULT (JSON_OBJECT()),
      shipping_address JSON NOT NULL DEFAULT (JSON_OBJECT()),
      payment_term VARCHAR(40) NULL,
      credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0,
      outstanding_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      tags JSON NOT NULL DEFAULT (JSON_ARRAY()),
      status ENUM('active','inactive','blacklisted') NOT NULL DEFAULT 'active',
      owner_id CHAR(36) NULL,
      source ENUM('manual','import','project','other') NOT NULL DEFAULT 'manual',
      notes TEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      created_by CHAR(36) NOT NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      deleted_at DATETIME(3) NULL,
      CONSTRAINT fk_clients_owner FOREIGN KEY (owner_id) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_clients_creator FOREIGN KEY (created_by) REFERENCES hr_employees(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_contacts (
      id CHAR(36) NOT NULL PRIMARY KEY,
      client_id CHAR(36) NOT NULL,
      name VARCHAR(160) NOT NULL,
      role VARCHAR(120) NULL,
      mobile VARCHAR(40) NULL,
      email VARCHAR(160) NULL,
      is_primary TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_client_contacts_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_logs (
      id CHAR(36) NOT NULL PRIMARY KEY,
      client_id CHAR(36) NOT NULL,
      operator_id CHAR(36) NOT NULL,
      action ENUM('create','update','follow_up','new_outbound','payment','change_status') NOT NULL,
      content TEXT NOT NULL,
      next_follow_up DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_client_logs_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      CONSTRAINT fk_client_logs_operator FOREIGN KEY (operator_id) REFERENCES hr_employees(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeCreateIndex('CREATE INDEX idx_clients_status ON clients(status, updated_at DESC)');
  await safeCreateIndex('CREATE INDEX idx_clients_owner ON clients(owner_id, status)');
  await safeCreateIndex('CREATE INDEX idx_clients_search ON clients(display_name, company_name)');
  await safeCreateIndex('CREATE INDEX idx_client_contacts_client ON client_contacts(client_id, is_primary)');
  await safeCreateIndex('CREATE INDEX idx_client_logs_client ON client_logs(client_id, created_at DESC)');

  initialized = true;
}
