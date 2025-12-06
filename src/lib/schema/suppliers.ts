import type { Pool, RowDataPacket } from 'mysql2/promise';

import { schemaPool, safeCreateIndex } from '@/lib/schema/mysql-utils';
import { ensureUsersSchema } from '@/lib/schema/users';

let initialized = false;

const DEFAULT_SUPPLIERS = [
  { name: '淘宝', shortName: 'Taobao', category: '电商平台' },
  { name: '拼多多', shortName: 'PDD', category: '电商平台' },
  { name: '京东', shortName: 'JD', category: '电商平台' },
  { name: '1688', shortName: '1688', category: '电商平台' },
];

async function seedDefaultSuppliers(pool: Pool) {
  if (!DEFAULT_SUPPLIERS.length) return;
  const [creatorRows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM hr_employees WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1`
  );
  const creatorId = creatorRows[0]?.id as string | undefined;
  if (!creatorId) {
    console.warn('[suppliers] skip default seeding, no employee exists yet');
    return;
  }

  for (const supplier of DEFAULT_SUPPLIERS) {
    await pool.query(
      `INSERT INTO suppliers (id, name, short_name, category, status, created_by)
       SELECT UUID(), ?, ?, ?, 'active', ? FROM dual
       WHERE NOT EXISTS (
         SELECT 1 FROM suppliers WHERE name = ? AND is_deleted = 0 LIMIT 1
       )`,
      [supplier.name, supplier.shortName ?? null, supplier.category ?? null, creatorId, supplier.name]
    );
  }
}

export async function ensureSuppliersSchema() {
  if (initialized) return;

  await ensureUsersSchema();
  const pool = schemaPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      short_name VARCHAR(120) NULL,
      category VARCHAR(80) NULL,
      rating TINYINT NULL,
      tax_number VARCHAR(80) NULL,
      invoice_title VARCHAR(255) NULL,
      registered_address VARCHAR(255) NULL,
      office_address VARCHAR(255) NULL,
      website VARCHAR(255) NULL,
      phone VARCHAR(40) NULL,
      mobile VARCHAR(40) NULL,
      email VARCHAR(160) NULL,
      payment_term VARCHAR(40) NULL,
      credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0,
      outstanding_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      tags JSON NOT NULL DEFAULT (JSON_ARRAY()),
      status ENUM('active','inactive','blacklisted') NOT NULL DEFAULT 'active',
      notes TEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      created_by CHAR(36) NOT NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      deleted_at DATETIME(3) NULL,
      CONSTRAINT fk_suppliers_creator FOREIGN KEY (created_by) REFERENCES hr_employees(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_contacts (
      id CHAR(36) NOT NULL PRIMARY KEY,
      supplier_id CHAR(36) NOT NULL,
      name VARCHAR(160) NOT NULL,
      role VARCHAR(120) NULL,
      mobile VARCHAR(40) NULL,
      email VARCHAR(160) NULL,
      note VARCHAR(255) NULL,
      is_primary TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_supplier_contacts_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_bank_accounts (
      id CHAR(36) NOT NULL PRIMARY KEY,
      supplier_id CHAR(36) NOT NULL,
      bank_name VARCHAR(180) NOT NULL,
      account_name VARCHAR(180) NOT NULL,
      account_number VARCHAR(120) NOT NULL,
      branch VARCHAR(180) NULL,
      country VARCHAR(80) NULL,
      currency VARCHAR(16) NULL,
      swift_code VARCHAR(30) NULL,
      note VARCHAR(255) NULL,
      is_primary TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_supplier_bank_accounts_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeCreateIndex('CREATE INDEX idx_suppliers_status ON suppliers(status, updated_at DESC)');
  await safeCreateIndex('CREATE INDEX idx_suppliers_search ON suppliers(name, short_name, tax_number)');
  await safeCreateIndex('CREATE INDEX idx_supplier_contacts_supplier ON supplier_contacts(supplier_id, is_primary)');
  await safeCreateIndex('CREATE INDEX idx_supplier_bank_accounts_supplier ON supplier_bank_accounts(supplier_id, is_primary)');

  await seedDefaultSuppliers(pool);

  initialized = true;
}
