import { randomUUID } from 'crypto';
import { mysqlPool } from './mysql';
import { RowDataPacket } from 'mysql2/promise';
import { formatDateTimeLocal } from './dates';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'QUERY' | 'EXPORT' | 'IMPORT' | 'APPROVE' | 'REJECT' | 'REVOKE' | 'SUBMIT' | 'PAY';

export type AuditEntityType = 
  | 'PURCHASE'
  | 'INVENTORY_ITEM'
  | 'INVENTORY_MOVEMENT'
  | 'FINANCE_RECORD'
  | 'BUDGET_ADJUSTMENT'
  | 'REIMBURSEMENT'
  | 'EMPLOYEE'
  | 'VENDOR'
  | 'WAREHOUSE'
  | 'AUTH'
  | 'SYSTEM'
  | 'REPORT';

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
  description?: string;
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
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      entity_name VARCHAR(500),
      old_values TEXT,
      new_values TEXT,
      description TEXT,
      ip_address VARCHAR(45),
      user_agent VARCHAR(500),
      created_at DATETIME
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  await mysqlPool().query(createTableSQL);

  // 迁移：确保 action 字段长度足够且不是 ENUM
  try {
    await mysqlPool().query('ALTER TABLE system_audit_logs MODIFY COLUMN action VARCHAR(50) NOT NULL');
  } catch (e) { /* ignore if already modified */ }

  // 迁移：确保 entity_id 字段长度足够（支持 LIST 等非 UUID）
  try {
    await mysqlPool().query('ALTER TABLE system_audit_logs MODIFY COLUMN entity_id VARCHAR(100) NOT NULL');
  } catch (e) { /* ignore */ }

  // MySQL 5.5 Check if column exists, if not add it
  try {
    const [columns] = await mysqlPool().query<RowDataPacket[]>(
      "SHOW COLUMNS FROM system_audit_logs LIKE 'description'"
    );
    if (columns.length === 0) {
      await mysqlPool().query('ALTER TABLE system_audit_logs ADD COLUMN description TEXT AFTER new_values');
    }
  } catch { /* table might not exist yet, handled by CREATE TABLE IF NOT EXISTS */ }
  
  // MySQL 5.5 doesn't support multiple INDEX in one statement
  try {
    await mysqlPool().query('CREATE INDEX idx_audit_entity ON system_audit_logs(entity_type, entity_id)');
  } catch { /* index may exist */ }
  try {
    await mysqlPool().query('CREATE INDEX idx_audit_user ON system_audit_logs(user_id)');
  } catch { /* index may exist */ }
  try {
    await mysqlPool().query('CREATE INDEX idx_audit_created ON system_audit_logs(created_at)');
  } catch { /* index may exist */ }
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
  description?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await ensureSystemAuditSchema();
    const pool = mysqlPool();
    const id = randomUUID();
    const now = formatDateTimeLocal(new Date());

    let oldValues = params.oldValues;
    let newValues = params.newValues;

    // 如果是更新操作且提供了新旧值，则进行差分对比
    if (params.action === 'UPDATE' && oldValues && newValues) {
      const diffOld: Record<string, unknown> = {};
      const diffNew: Record<string, unknown> = {};
      const isNullish = (v: unknown) => v === null || v === undefined || v === '';

      for (const key in newValues) {
        if (key === 'updated_at' || key === 'updatedAt') continue;
        
        const ov = oldValues[key];
        const nv = newValues[key];

        // 严格对比逻辑
        const ovStr = isNullish(ov) ? '' : String(ov);
        const nvStr = isNullish(nv) ? '' : String(nv);

        // 如果是数组，进行深层一点的对比（简单转换为字符串对比）
        const isArrayMatch = Array.isArray(ov) && Array.isArray(nv) && JSON.stringify(ov) === JSON.stringify(nv);

        if (ovStr !== nvStr && !isArrayMatch) {
          diffOld[key] = ov;
          diffNew[key] = nv;
        }
      }

      // 如果没有任何字段变化，且没有手动提供描述，则不进行记录
      if (Object.keys(diffNew).length === 0 && !params.description) {
        return;
      }

      oldValues = diffOld;
      newValues = diffNew;
    }

    await pool.query(
      `INSERT INTO system_audit_logs (id, user_id, user_name, action, entity_type, entity_id, entity_name, old_values, new_values, description, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        params.userId, 
        params.userName, 
        params.action, 
        params.entityType, 
        params.entityId, 
        params.entityName ?? null, 
        oldValues ? JSON.stringify(oldValues) : null, 
        newValues ? JSON.stringify(newValues) : null, 
        params.description ?? null,
        params.ipAddress ?? null, 
        params.userAgent ?? null, 
        now
      ]
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
           old_values, new_values, description, ip_address, user_agent, created_at
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
      description: string | null;
      ip_address: string | null;
      user_agent: string | null;
      created_at: string;
    }>>(dataSQL, [...values, pageSize, offset]);

    const parseJsonField = (value: unknown): Record<string, unknown> | undefined => {
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
    };

    for (const row of rows) {
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
        description: row.description ?? undefined,
        ipAddress: row.ip_address ?? undefined,
        userAgent: row.user_agent ?? undefined,
        createdAt: row.created_at,
      });
    }
  }
  
  return { items, total };
}

export function formatAuditDescription(log: AuditLogEntry): string {
  if (log.description) return log.description;

  const entityTypeLabels: Record<string, string> = {
    PURCHASE: '采购单',
    INVENTORY_ITEM: '库存商品',
    INVENTORY_MOVEMENT: '库存流水',
    FINANCE_RECORD: '财务记录',
    BUDGET_ADJUSTMENT: '预算调整',
    REIMBURSEMENT: '报销',
    EMPLOYEE: '员工',
    VENDOR: '供应商',
    WAREHOUSE: '仓库',
    AUTH: '认证',
    SYSTEM: '系统',
    REPORT: '报表',
  };

  const actionLabels: Record<string, string> = {
    CREATE: '新增',
    UPDATE: '修改',
    DELETE: '删除',
    LOGIN: '登录',
    LOGOUT: '登出',
    SUBMIT: '提交',
    APPROVE: '审批通过',
    REJECT: '驳回',
    REVOKE: '撤回',
    PAY: '支付',
    QUERY: '查询',
  };

  const fieldLabels: Record<string, string> = {
    // 基础信息
    gender: '性别',
    displayName: '显示名称',
    display_name: '显示名称',
    email: '邮箱',
    phone: '手机号',
    address: '地址',
    location: '位置',
    hireDate: '入职日期',
    hire_date: '入职日期',
    terminationDate: '离职日期',
    termination_date: '离职日期',
    employmentStatus: '在职状态',
    employment_status: '在职状态',
    
    // 权限与系统
    role: '角色',
    primaryRole: '主角色',
    primary_role: '主角色',
    is_active: '是否启用',
    is_super_admin: '是否超级管理员',
    password_hash: '密码哈希',
    initialPassword: '初始密码',
    statusChangeNote: '状态变更备注',
    roles: '角色列表',
    
    // 库存
    name: '名称',
    sku: 'SKU',
    category: '类别',
    unit: '单位',
    safetyStock: '安全库存储备',
    quantity: '数量',
    specification: '规格',
    
    // 财务与采购
    status: '状态',
    totalAmount: '总金额',
    total_amount: '总金额',
    total_price: '总价',
    unitPrice: '单价',
    unit_price: '单价',
    feeAmount: '费用金额',
    fee_amount: '费用金额',
    itemName: '项目名称',
    item_name: '项目名称',
    reason: '原因',
    comment: '备注',
    notes: '备注',
    note: '备注',
    attachments: '附件',
    invoiceImages: '发票图片',
    receiptImages: '回执图片',
    vendorId: '供应商',
    vendor_id: '供应商',
    departmentId: '部门',
    department_id: '部门',
    applier_id: '申请人',
  };

  const valueLabels: Record<string, string> = {
    super_admin: '超级管理员',
    admin: '管理员',
    user: '普通用户',
    purchaser: '采购员',
    warehouse_manager: '仓库管理员',
    finance: '财务人员',
    finance_company: '财务负责人',
    hr: '人事人员',
    active: '在职',
    terminated: '离职',
    on_leave: '请假',
    draft: '草稿',
    pending_approval: '待审批',
    approved: '已通过',
    rejected: '已驳回',
    revoked: '已撤回',
    withdrawn: '已撤销',
    paid: '已支付',
    processing: '处理中',
    completed: '已完成',
    male: '男',
    female: '女',
    other: '其他',
    unknown: '未知',
    'true': '是',
    'false': '否'
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined || val === '') return '无';
    if (typeof val === 'boolean') return val ? '是' : '否';
    if (Array.isArray(val)) {
      return val.map(v => valueLabels[String(v)] || String(v)).join(', ');
    }
    if (typeof val === 'object') return JSON.stringify(val);
    const strVal = String(val);
    return valueLabels[strVal] || strVal;
  };

  const entityName = log.entityName || log.entityId;
  const entityType = entityTypeLabels[log.entityType] || log.entityType;
  const action = actionLabels[log.action] || log.action;

  if (log.action === 'LOGIN') return `${log.userName} 登录了系统`;
  if (log.action === 'LOGOUT') return `${log.userName} 登出了系统`;

  if (log.action === 'QUERY' && log.newValues) {
    const params = log.newValues;
    const details = [];
    if (params.page) details.push(`第 ${params.page} 页`);
    if (params.pageSize) details.push(`每页 ${params.pageSize} 条`);
    if (params.search) details.push(`搜索关键词: "${params.search}"`);
    if (params.status && params.status !== 'all') details.push(`状态: ${valueLabels[params.status as string] || params.status}`);
    
    const detailsStr = details.length > 0 ? ` (${details.join(', ')})` : '';
    return `查询了 ${entityType} 列表${detailsStr}`;
  }

  if (log.oldValues && log.newValues) {
    const changes: string [] = [];
    const isNullish = (v: unknown) => v === null || v === undefined || v === '';

    for (const key in log.newValues) {
      if (key === 'updated_at' || key === 'updatedAt') continue;

      const oldValRaw = log.oldValues[key];
      const newValRaw = log.newValues[key];
      
      if (isNullish(oldValRaw) && isNullish(newValRaw)) continue;

      const oldValFormatted = formatValue(oldValRaw);
      const newValFormatted = formatValue(newValRaw);

      if (oldValFormatted !== newValFormatted) {
        const label = fieldLabels[key] || key;
        changes.push(`将「${label}」由「${oldValFormatted}」修改为「${newValFormatted}」`);
      }
    }
    if (changes.length > 0) {
      return `${action}了 ${entityType} [${entityName}]：\n${changes.join('\n')}`;
    }
  }

  return `${action}了 ${entityType} [${entityName}]`;
}
