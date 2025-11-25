import type { Pool } from 'mysql2/promise';

import { mysqlPool } from '@/lib/mysql';
import { ensureColumn, ensureForeignKey } from '@/lib/schema/mysql-utils';
import { ensureProjectsSchema } from '@/lib/schema/projects';
import { ensurePurchasesSchema } from '@/lib/schema/purchases';
import { ensureProjectPaymentsSchema } from '@/lib/schema/project-payments';
import { ensureInventorySchema } from '@/lib/schema/inventory';
import { getDefaultCategoryLabels } from '@/constants/finance-categories';
import { TransactionType } from '@/types/finance';

let initialized = false;

const defaultCategories: Record<TransactionType, string[]> = {
  [TransactionType.INCOME]: getDefaultCategoryLabels(TransactionType.INCOME),
  [TransactionType.EXPENSE]: getDefaultCategoryLabels(TransactionType.EXPENSE),
};

async function createIndex(pool: Pool, sql: string) {
  try {
    await pool.query(sql);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'ER_DUP_KEYNAME') {
      throw error;
    }
  }
}

async function seedDefaultCategories(pool: Pool) {
  const tasks: Promise<unknown>[] = [];
  (Object.keys(defaultCategories) as TransactionType[]).forEach((type) => {
    defaultCategories[type].forEach((name) => {
      tasks.push(
        pool.query(
          'INSERT IGNORE INTO finance_categories (type, name, is_default) VALUES (?, ?, 1)',
          [type, name]
        )
      );
    });
  });
  await Promise.all(tasks);
}

export async function ensureFinanceSchema() {
  if (initialized) return;

  await ensureProjectsSchema();
  await ensurePurchasesSchema();
  await ensureProjectPaymentsSchema();
  await ensureInventorySchema();
  const pool = mysqlPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_records (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type ENUM('income','expense') NOT NULL,
      category VARCHAR(120) NOT NULL,
      date_value DATE NOT NULL,
      contract_amount DECIMAL(16,2) NOT NULL DEFAULT 0,
      fee DECIMAL(16,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(16,2) NOT NULL DEFAULT 0,
      payment_type ENUM('deposit','full','installment','balance','other') NOT NULL,
      quantity DECIMAL(16,2) NOT NULL DEFAULT 1,
      payment_channel VARCHAR(120),
      payer VARCHAR(120),
      transaction_no VARCHAR(160),
      invoice_json JSON NULL,
      description TEXT,
      tags_json JSON NULL,
      created_by VARCHAR(64),
      source_type ENUM('manual','purchase','project','import','inventory','project_payment') NOT NULL DEFAULT 'manual',
      status ENUM('draft','cleared') NOT NULL DEFAULT 'draft',
      purchase_id CHAR(36) NULL,
      project_id CHAR(36) NULL,
      inventory_movement_id VARCHAR(64) NULL,
      metadata_json JSON NULL,
      project_payment_id CHAR(36) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await ensureColumn(
    'finance_records',
    'source_type',
    "ENUM('manual','purchase','project','import','inventory','project_payment') NOT NULL DEFAULT 'manual'"
  );
  await pool.query(
    "ALTER TABLE `finance_records` MODIFY COLUMN `source_type` ENUM('manual','purchase','project','import','inventory','project_payment') NOT NULL DEFAULT 'manual'"
  );
  await ensureColumn('finance_records', 'purchase_id', 'CHAR(36) NULL');
  await ensureColumn('finance_records', 'project_id', 'CHAR(36) NULL');
  await ensureColumn('finance_records', 'inventory_movement_id', 'VARCHAR(64) NULL');
  await ensureColumn('finance_records', 'project_payment_id', 'CHAR(36) NULL');
  await ensureColumn('finance_records', 'quantity', 'DECIMAL(16,2) NOT NULL DEFAULT 1');
  await ensureColumn('finance_records', 'payment_channel', 'VARCHAR(120) NULL');
  await ensureColumn('finance_records', 'payer', 'VARCHAR(120) NULL');
  await ensureColumn('finance_records', 'transaction_no', 'VARCHAR(160) NULL');
  await ensureColumn('finance_records', 'status', "ENUM('draft','cleared') NOT NULL DEFAULT 'draft'");
  await ensureColumn('finance_records', 'metadata_json', 'JSON NULL');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_categories (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      type ENUM('income','expense') NOT NULL,
      name VARCHAR(120) NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_finance_category (type, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await createIndex(pool, 'CREATE INDEX idx_finance_date ON finance_records(date_value)');
  await createIndex(pool, 'CREATE INDEX idx_finance_type ON finance_records(type)');
  await createIndex(pool, 'CREATE INDEX idx_finance_category ON finance_records(category)');
  await createIndex(pool, 'CREATE INDEX idx_finance_purchase ON finance_records(purchase_id)');
  await createIndex(pool, 'CREATE INDEX idx_finance_project ON finance_records(project_id)');
  await createIndex(pool, 'CREATE INDEX idx_finance_inventory_movement ON finance_records(inventory_movement_id)');
  await createIndex(pool, 'CREATE INDEX idx_finance_project_payment ON finance_records(project_payment_id)');
  await ensureForeignKey(
    'finance_records',
    'fk_finance_purchase',
    'FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL'
  );
  await ensureForeignKey(
    'finance_records',
    'fk_finance_project',
    'FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL'
  );
  await ensureForeignKey(
    'finance_records',
    'fk_finance_inventory_movement',
    'FOREIGN KEY (inventory_movement_id) REFERENCES inventory_movements(id) ON DELETE SET NULL'
  );
  await ensureForeignKey(
    'finance_records',
    'fk_finance_project_payment',
    'FOREIGN KEY (project_payment_id) REFERENCES project_payments(id) ON DELETE SET NULL'
  );

  await seedDefaultCategories(pool);

  initialized = true;
}
