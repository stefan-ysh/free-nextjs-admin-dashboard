import type { Pool } from 'mysql2/promise';

import { mysqlPool } from '@/lib/mysql';
import { ensureColumn, ensureForeignKey } from '@/lib/schema/mysql-utils';
import { ensurePurchasesSchema } from '@/lib/schema/purchases';
import { ensureInventorySchema } from '@/lib/schema/inventory';
import { ensureReimbursementsSchema } from '@/lib/schema/reimbursements';
import { getDefaultCategoryLabels } from '@/constants/finance-categories';
import { TransactionType } from '@/types/finance';

let initializationPromise: Promise<void> | null = null;

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

async function dropForeignKeyIfExists(pool: Pool, table: string, constraint: string) {
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

async function dropIndexIfExists(pool: Pool, table: string, index: string) {
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

async function dropColumnIfExists(pool: Pool, table: string, column: string) {
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
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      await ensurePurchasesSchema();
      await ensureInventorySchema();
      await ensureReimbursementsSchema();
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
          source_type ENUM('manual','reimbursement','budget_adjustment','inventory') NOT NULL DEFAULT 'manual',
          status ENUM('draft','cleared') NOT NULL DEFAULT 'draft',
          purchase_id CHAR(36) NULL,
          reimbursement_id CHAR(36) NULL,
          inventory_movement_id VARCHAR(64) NULL,
          metadata_json JSON NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await ensureColumn(
        'finance_records',
        'source_type',
        "ENUM('manual','reimbursement','budget_adjustment','inventory') NOT NULL DEFAULT 'manual'"
      );
      // Removed redundant ALTER TABLE that might cause deadlocks if column exists
      // The ensureColumn helper should handle existence check
      
      await ensureColumn('finance_records', 'purchase_id', 'CHAR(36) NULL');
      await ensureColumn('finance_records', 'reimbursement_id', 'CHAR(36) NULL');
      await ensureColumn('finance_records', 'inventory_movement_id', 'VARCHAR(64) NULL');
      await ensureColumn('finance_records', 'quantity', 'DECIMAL(16,2) NOT NULL DEFAULT 1');
      await ensureColumn('finance_records', 'payment_channel', 'VARCHAR(120) NULL');
      await ensureColumn('finance_records', 'payer', 'VARCHAR(120) NULL');
      await ensureColumn('finance_records', 'transaction_no', 'VARCHAR(160) NULL');
      await ensureColumn('finance_records', 'status', "ENUM('draft','cleared') NOT NULL DEFAULT 'draft'");
      await ensureColumn('finance_records', 'metadata_json', 'JSON NULL');
      await dropForeignKeyIfExists(pool, 'finance_records', 'fk_finance_supplier');
      await dropIndexIfExists(pool, 'finance_records', 'idx_finance_supplier');
      await dropColumnIfExists(pool, 'finance_records', 'supplier_id');
      
      // Cleanup removed columns
      await dropForeignKeyIfExists(pool, 'finance_records', 'fk_finance_project');
      await dropForeignKeyIfExists(pool, 'finance_records', 'fk_finance_project_payment');
      await dropIndexIfExists(pool, 'finance_records', 'idx_finance_project');
      await dropIndexIfExists(pool, 'finance_records', 'idx_finance_project_payment');
      await dropColumnIfExists(pool, 'finance_records', 'project_id');
      await dropColumnIfExists(pool, 'finance_records', 'project_payment_id');

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

      await pool.query(`
        CREATE TABLE IF NOT EXISTS finance_budget_adjustments (
          id CHAR(36) NOT NULL PRIMARY KEY,
          organization_type ENUM('school','company') NOT NULL,
          adjustment_type ENUM('increase','decrease') NOT NULL DEFAULT 'increase',
          amount DECIMAL(16,2) NOT NULL,
          title VARCHAR(255) NOT NULL,
          note TEXT NULL,
          occurred_at DATE NOT NULL,
          created_by CHAR(36) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT chk_finance_budget_adjustment_amount CHECK (amount > 0),
          CONSTRAINT fk_finance_budget_adjustments_creator FOREIGN KEY (created_by) REFERENCES hr_employees(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await createIndex(pool, 'CREATE INDEX idx_finance_date ON finance_records(date_value)');
      await createIndex(pool, 'CREATE INDEX idx_finance_type ON finance_records(type)');
      await createIndex(pool, 'CREATE INDEX idx_finance_category ON finance_records(category)');
      await createIndex(pool, 'CREATE INDEX idx_finance_purchase ON finance_records(purchase_id)');
      await createIndex(pool, 'CREATE INDEX idx_finance_reimbursement ON finance_records(reimbursement_id)');
      await createIndex(pool, 'CREATE INDEX idx_finance_inventory_movement ON finance_records(inventory_movement_id)');
      await createIndex(pool, 'CREATE INDEX idx_finance_budget_adjust_org_date ON finance_budget_adjustments(organization_type, occurred_at)');
      await ensureForeignKey(
        'finance_records',
        'fk_finance_purchase',
        'FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL'
      );
      await ensureForeignKey(
        'finance_records',
        'fk_finance_reimbursement',
        'FOREIGN KEY (reimbursement_id) REFERENCES reimbursements(id) ON DELETE SET NULL'
      );
      await ensureForeignKey(
        'finance_records',
        'fk_finance_inventory_movement',
        'FOREIGN KEY (inventory_movement_id) REFERENCES inventory_movements(id) ON DELETE SET NULL'
      );

      await dropForeignKeyIfExists(pool, 'finance_records', 'fk_finance_purchase_payment');
      await dropIndexIfExists(pool, 'finance_records', 'idx_finance_purchase_payment');
      await dropColumnIfExists(pool, 'finance_records', 'purchase_payment_id');

      await seedDefaultCategories(pool);
    } catch (error) {
       console.error('Failed to initialize finance schema:', error);
       initializationPromise = null; // Reset on failure so it can be retried
       throw error;
    }
  })();

  return initializationPromise;
}
