import { randomUUID } from 'crypto';
import { mysqlPool } from './mysql';
import { RowDataPacket } from 'mysql2/promise';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type AuditEntityType = 
  | 'PURCHASE'
  | 'INVENTORY_ITEM'
  | 'INVENTORY_MOVEMENT'
  | 'FINANCE_RECORD'
  | 'BUDGET_ADJUSTMENT'
  | 'REIMBURSEMENT'
  | 'EMPLOYEE'
  | 'VENDOR'
  | 'WAREHOUSE';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

async function ensureSystemAuditSchema() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS system_audit_logs (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      action VARCHAR(20) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(36) NOT NULL,
      entity_name VARCHAR(500),
      old_values TEXT,
      new_values TEXT,
      ip_address VARCHAR(45),
      user_agent VARCHAR(500),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  await mysqlPool().query(createTableSQL);
  
  // MySQL 5.5 doesn't support multiple INDEX in one statement
  try {
    await mysqlPool().query('CREATE INDEX idx_audit_entity ON system_audit_logs(entity_type, entity_id)');
  } catch (e) { /* index may exist */ }
  try {
    await mysqlPool().query('CREATE INDEX idx_audit_user ON system_audit_logs(user_id)');
  } catch (e) { /* index may exist */ }
  try {
    await mysqlPool().query('CREATE INDEX idx_audit_created ON system_audit_logs(created_at)');
  } catch (e) { /* index may exist */ }
}

export async function logSystemAudit(params: {
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await ensureSystemAuditSchema();
    const pool = mysqlPool();
    const id = randomUUID();
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    await pool.query(
      `INSERT INTO system_audit_logs (id, user_id, user_name, action, entity_type, entity_id, entity_name, old_values, new_values, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, params.userId, params.userName, params.action, params.entityType, params.entityId, params.entityName ?? null, params.oldValues ? JSON.stringify(params.oldValues) : null, params.newValues ? JSON.stringify(params.newValues) : null, params.ipAddress ?? null, params.userAgent ?? null, now]
    );
  } catch (error) {
    console.error('Failed to write system audit log:', error);
  }
}

export async function querySystemAuditLogs(params: {
  entityType?: AuditEntityType;
  entityId?: string;
  userId?: string;
  action?: AuditAction;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: AuditLogEntry[]; total: number }> {
  const pool = mysqlPool();
  await ensureSystemAuditSchema();
  
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  
  const conditions: string[] = [];
  const values: unknown[] = [];
  
  if (params.entityType) {
    conditions.push('entity_type = ?');
    values.push(params.entityType);
  }
  if (params.entityId) {
    conditions.push('entity_id = ?');
    values.push(params.entityId);
  }
  if (params.userId) {
    conditions.push('user_id = ?');
    values.push(params.userId);
  }
  if (params.action) {
    conditions.push('action = ?');
    values.push(params.action);
  }
  if (params.startDate) {
    conditions.push('created_at >= ?');
    values.push(params.startDate);
  }
  if (params.endDate) {
    conditions.push('created_at <= ?');
    values.push(params.endDate);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const countSQL = `SELECT COUNT(*) as total FROM system_audit_logs ${whereClause}`;
  const dataSQL = `
    SELECT id, user_id, user_name, action, entity_type, entity_id, entity_name, 
           old_values, new_values, ip_address, user_agent, created_at
    FROM system_audit_logs 
    ${whereClause} 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `;
  
  const [countResult] = await pool.query<Array<RowDataPacket & { total: number }>>(countSQL, values);
  const total = countResult[0]?.total ?? 0;
  
  const items: AuditLogEntry[] = [];
  
  if (total > 0) {
    const [rows] = await pool.query<Array<RowDataPacket & {
      id: string;
      user_id: string;
      user_name: string;
      action: AuditAction;
      entity_type: AuditEntityType;
      entity_id: string;
      entity_name: string | null;
      old_values: string | null;
      new_values: string | null;
      ip_address: string | null;
      user_agent: string | null;
      created_at: string;
    }>>(dataSQL, [...values, pageSize, offset]);
    
    for (const row of rows) {
function parseJsonField(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

      items.push({
        id: row.id,
        userId: row.user_id,
        userName: row.user_name,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        entityName: row.entity_name ?? undefined,
        oldValues: parseJsonField(row.old_values),
        newValues: parseJsonField(row.new_values),
        ipAddress: row.ip_address ?? undefined,
        userAgent: row.user_agent ?? undefined,
        createdAt: row.created_at,
      });
    }
  }
  
  return { items, total };
}
