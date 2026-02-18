-- Cleanup script for removed legacy modules.
-- Execute manually in MySQL after code deployment.

SET FOREIGN_KEY_CHECKS = 0;

-- Remove obsolete links from finance_records first (safe-if-exists).
SET @drop_fk_sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'finance_records'
        AND CONSTRAINT_NAME = 'fk_finance_purchase_payment'
    ),
    'ALTER TABLE finance_records DROP FOREIGN KEY fk_finance_purchase_payment',
    'SELECT 1'
  )
);
PREPARE stmt FROM @drop_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @drop_idx_sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'finance_records'
        AND INDEX_NAME = 'idx_finance_purchase_payment'
    ),
    'ALTER TABLE finance_records DROP INDEX idx_finance_purchase_payment',
    'SELECT 1'
  )
);
PREPARE stmt FROM @drop_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @drop_col_sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'finance_records'
        AND COLUMN_NAME = 'purchase_payment_id'
    ),
    'ALTER TABLE finance_records DROP COLUMN purchase_payment_id',
    'SELECT 1'
  )
);
PREPARE stmt FROM @drop_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Removed business tables.
DROP TABLE IF EXISTS purchase_workflow_configs;
DROP TABLE IF EXISTS purchase_payments;
DROP TABLE IF EXISTS project_payments;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS calendar_events;
DROP TABLE IF EXISTS client_logs;
DROP TABLE IF EXISTS client_contacts;
DROP TABLE IF EXISTS clients;

SET FOREIGN_KEY_CHECKS = 1;
