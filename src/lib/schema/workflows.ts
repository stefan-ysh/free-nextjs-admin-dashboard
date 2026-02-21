import { mysqlPool } from '@/lib/mysql';

const pool = mysqlPool();

export async function ensureWorkflowConfigsSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_workflow_configs (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(255) NULL,
      module_name VARCHAR(50) NOT NULL,
      organization_type VARCHAR(50) NOT NULL,
      is_published TINYINT(1) NOT NULL DEFAULT 0,
      workflow_nodes JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by VARCHAR(36)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Try modifying the table if it already exists with the old schema (from Phase 5)
  try {
    await pool.query('ALTER TABLE system_workflow_configs DROP INDEX uk_module_org');
  } catch (e) { /* ignore */ }
  
  try {
    await pool.query('ALTER TABLE system_workflow_configs ADD COLUMN is_published TINYINT(1) NOT NULL DEFAULT 0 AFTER organization_type');
  } catch (e) { /* ignore */ }

  try {
    await pool.query('ALTER TABLE system_workflow_configs ADD COLUMN name VARCHAR(100) NOT NULL DEFAULT "未命名流程" AFTER id');
    await pool.query('ALTER TABLE system_workflow_configs ADD COLUMN description VARCHAR(255) NULL AFTER name');
  } catch (e) { /* ignore */ }

  try {
    await pool.query('ALTER TABLE system_workflow_configs CHANGE approver_user_ids workflow_nodes JSON NOT NULL');
  } catch (e) { /* ignore */ }
}

export async function ensureEntitiesWorkflowColumns() {
  // Add workflow tracking columns to purchases
  try {
    await pool.query(`
      ALTER TABLE purchases 
      ADD COLUMN workflow_current_node_id VARCHAR(50) NULL DEFAULT NULL AFTER status,
      ADD COLUMN workflow_nodes JSON NULL DEFAULT NULL AFTER workflow_current_node_id
    `);
  } catch (e) { /* ignore if columns exist */ }

  // Add workflow tracking columns to reimbursements
  try {
    await pool.query(`
      ALTER TABLE reimbursements 
      ADD COLUMN workflow_current_node_id VARCHAR(50) NULL DEFAULT NULL AFTER status,
      ADD COLUMN workflow_nodes JSON NULL DEFAULT NULL AFTER workflow_current_node_id
    `);
  } catch (e) { /* ignore if columns exist */ }
}
