import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { mysqlPool } from '@/lib/mysql';
import { ensurePurchasesSchema } from '@/lib/schema/purchases';
import type {
  PurchaseWorkflowEdge,
  PurchaseWorkflowConfig,
  PurchaseWorkflowConfigInput,
  PurchaseWorkflowNode,
  WorkflowPortDirection,
  WorkflowNodeType,
} from '@/types/purchase-workflow';
import type { PurchaseOrganization } from '@/types/purchase';
import { UserRole } from '@/types/user';

const DEFAULT_WORKFLOW_KEY = 'purchase_default';

const DEFAULT_NODES: PurchaseWorkflowNode[] = [
  {
    id: randomUUID(),
    nodeType: 'user_activity',
    name: '部门负责人审批',
    approverType: 'role',
    approverRole: UserRole.DEPARTMENT_MANAGER,
    approverUserId: null,
    approvalMode: 'serial',
    timeoutHours: 24,
    requiredComment: true,
    condition: {
      minAmount: null,
      maxAmount: null,
      organizationType: 'all',
    },
  },
  {
    id: randomUUID(),
    nodeType: 'user_activity',
    name: '财务复核',
    approverType: 'role',
    approverRole: UserRole.FINANCE,
    approverUserId: null,
    approvalMode: 'serial',
    timeoutHours: 24,
    requiredComment: true,
    condition: {
      minAmount: 5000,
      maxAmount: null,
      organizationType: 'all',
    },
  },
];

const ALLOWED_NODE_TYPES = new Set<WorkflowNodeType>([
  'user_activity',
  'system_activity',
  'sub_process',
  'connection',
  'circulate',
]);

const ALLOWED_PORTS = new Set<WorkflowPortDirection>(['top', 'right', 'bottom', 'left']);

function normalizeNodeType(value: unknown): WorkflowNodeType {
  if (typeof value === 'string' && ALLOWED_NODE_TYPES.has(value as WorkflowNodeType)) {
    return value as WorkflowNodeType;
  }
  return 'user_activity';
}

type WorkflowConfigRow = RowDataPacket & {
  workflow_key: string;
  name: string;
  enabled: number;
  nodes: string;
  updated_at: string;
  updated_by: string | null;
};

type ApproverRow = RowDataPacket & {
  id: string;
  display_name: string | null;
  email: string | null;
  primary_role: string | null;
  roles: string | null;
};

type EmployeeDepartmentRow = RowDataPacket & {
  department: string | null;
};

type ApproverCandidateRow = RowDataPacket & {
  id: string;
};

export type WorkflowPurchaseContext = {
  purchaserId: string;
  totalAmount: number;
  organizationType: PurchaseOrganization;
};

function parseNodes(value: string): PurchaseWorkflowNode[] {
  try {
    const parsed = JSON.parse(value) as PurchaseWorkflowNode[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((node) => ({
      id: typeof node.id === 'string' ? node.id : randomUUID(),
      nodeType: normalizeNodeType(node.nodeType),
      name: typeof node.name === 'string' ? node.name : '未命名节点',
      approverType: node.approverType === 'user' ? 'user' : 'role',
      approverRole: node.approverRole ?? null,
      approverUserId: node.approverUserId ?? null,
      approvalMode: node.approvalMode === 'any' ? 'any' : 'serial',
      timeoutHours: Math.max(1, Number(node.timeoutHours || 24)),
      requiredComment: Boolean(node.requiredComment),
      condition: {
        minAmount: node.condition?.minAmount ?? null,
        maxAmount: node.condition?.maxAmount ?? null,
        organizationType:
          node.condition?.organizationType === 'school' || node.condition?.organizationType === 'company'
            ? node.condition.organizationType
            : 'all',
      },
      position:
        node.position &&
        typeof (node.position as { x?: unknown }).x === 'number' &&
        Number.isFinite((node.position as { x: number }).x) &&
        typeof (node.position as { y?: unknown }).y === 'number' &&
        Number.isFinite((node.position as { y: number }).y)
          ? {
              x: Number((node.position as { x: number }).x),
              y: Number((node.position as { y: number }).y),
            }
          : null,
      extras:
        node.extras && typeof node.extras === 'object' && !Array.isArray(node.extras)
          ? (node.extras as Record<string, unknown>)
          : null,
    }));
  } catch {
    return [];
  }
}

function normalizePort(value: unknown): WorkflowPortDirection {
  if (typeof value === 'string' && ALLOWED_PORTS.has(value as WorkflowPortDirection)) {
    return value as WorkflowPortDirection;
  }
  return 'bottom';
}

function parseEdgesFromUnknown(value: unknown): PurchaseWorkflowEdge[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const edge = item as Partial<PurchaseWorkflowEdge>;
      return {
        id: typeof edge.id === 'string' && edge.id.trim() ? edge.id : randomUUID(),
        sourceId: typeof edge.sourceId === 'string' ? edge.sourceId : '',
        sourcePort: normalizePort(edge.sourcePort),
        targetId: typeof edge.targetId === 'string' ? edge.targetId : '',
        targetPort: normalizePort(edge.targetPort),
      };
    })
    .filter((edge) => edge.sourceId && edge.targetId);
}

function parseConfigJson(value: string): { nodes: PurchaseWorkflowNode[]; edges: PurchaseWorkflowEdge[] } {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      // Backward compatible: old structure is pure nodes array.
      return { nodes: parseNodes(value), edges: [] };
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as { nodes?: unknown; edges?: unknown };
      const nodes = parseNodes(JSON.stringify(Array.isArray(obj.nodes) ? obj.nodes : []));
      const edges = parseEdgesFromUnknown(obj.edges);
      return { nodes, edges };
    }
    return { nodes: [], edges: [] };
  } catch {
    return { nodes: [], edges: [] };
  }
}

function normalizeInput(input: PurchaseWorkflowConfigInput): PurchaseWorkflowConfigInput {
  return {
    name: input.name?.trim() || '采购审批流程',
    enabled: Boolean(input.enabled),
    nodes: Array.isArray(input.nodes)
      ? input.nodes.map((node) => ({
          id: node.id?.trim() || randomUUID(),
          nodeType: normalizeNodeType(node.nodeType),
          name: node.name?.trim() || '未命名节点',
          approverType: node.approverType === 'user' ? 'user' : 'role',
          approverRole: node.approverType === 'role' ? node.approverRole ?? UserRole.ADMIN : null,
          approverUserId: node.approverType === 'user' ? node.approverUserId ?? null : null,
          approvalMode: node.approvalMode === 'any' ? 'any' : 'serial',
          timeoutHours: Math.max(1, Number(node.timeoutHours || 24)),
          requiredComment: Boolean(node.requiredComment),
          condition: {
            minAmount: node.condition?.minAmount ?? null,
            maxAmount: node.condition?.maxAmount ?? null,
            organizationType:
              node.condition?.organizationType === 'school' || node.condition?.organizationType === 'company'
                ? node.condition.organizationType
                : 'all',
          },
          position:
            node.position &&
            typeof node.position.x === 'number' &&
            Number.isFinite(node.position.x) &&
            typeof node.position.y === 'number' &&
            Number.isFinite(node.position.y)
              ? { x: Number(node.position.x), y: Number(node.position.y) }
              : null,
          extras:
            node.extras && typeof node.extras === 'object' && !Array.isArray(node.extras)
              ? (node.extras as Record<string, unknown>)
              : null,
        }))
      : [],
    edges: Array.isArray(input.edges)
      ? input.edges
          .map((edge) => ({
            id: typeof edge?.id === 'string' && edge.id.trim() ? edge.id : randomUUID(),
            sourceId: typeof edge?.sourceId === 'string' ? edge.sourceId : '',
            sourcePort: normalizePort(edge?.sourcePort),
            targetId: typeof edge?.targetId === 'string' ? edge.targetId : '',
            targetPort: normalizePort(edge?.targetPort),
          }))
          .filter((edge) => edge.sourceId && edge.targetId)
      : [],
  };
}

async function ensureDefaultWorkflow(): Promise<void> {
  const pool = mysqlPool();
  const [rows] = await pool.query<WorkflowConfigRow[]>(
    'SELECT workflow_key FROM purchase_workflow_configs WHERE workflow_key = ? LIMIT 1',
    [DEFAULT_WORKFLOW_KEY]
  );

  if (rows.length > 0) return;

  await pool.query(
    `INSERT INTO purchase_workflow_configs (id, workflow_key, name, enabled, nodes)
     VALUES (?, ?, ?, 1, ?)` ,
    [
      randomUUID(),
      DEFAULT_WORKFLOW_KEY,
      '采购审批流程',
      JSON.stringify({
        nodes: DEFAULT_NODES,
        edges: [],
      }),
    ]
  );
}

async function ensurePurchaseWorkflowSchema(): Promise<void> {
  const pool = mysqlPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_workflow_configs (
      id CHAR(36) NOT NULL PRIMARY KEY,
      workflow_key VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      nodes JSON NOT NULL,
      updated_by CHAR(36),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_purchase_workflow_updated_by FOREIGN KEY (updated_by) REFERENCES hr_employees(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function getPurchaseWorkflowConfig(): Promise<PurchaseWorkflowConfig> {
  await ensurePurchasesSchema();
  await ensurePurchaseWorkflowSchema();
  await ensureDefaultWorkflow();

  const pool = mysqlPool();
  const [rows] = await pool.query<WorkflowConfigRow[]>(
    `SELECT workflow_key, name, enabled, nodes, updated_at, updated_by
     FROM purchase_workflow_configs
     WHERE workflow_key = ?
     LIMIT 1`,
    [DEFAULT_WORKFLOW_KEY]
  );

  const row = rows[0];
  if (!row) {
    return {
      workflowKey: DEFAULT_WORKFLOW_KEY,
      name: '采购审批流程',
      enabled: true,
      nodes: DEFAULT_NODES,
      edges: [],
      updatedAt: new Date().toISOString(),
      updatedBy: null,
    };
  }

  const parsed = parseConfigJson(row.nodes);

  return {
    workflowKey: row.workflow_key,
    name: row.name,
    enabled: Boolean(row.enabled),
    nodes: parsed.nodes,
    edges: parsed.edges,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export async function upsertPurchaseWorkflowConfig(
  input: PurchaseWorkflowConfigInput,
  operatorId: string
): Promise<PurchaseWorkflowConfig> {
  await ensurePurchasesSchema();
  await ensurePurchaseWorkflowSchema();
  const normalized = normalizeInput(input);
  const pool = mysqlPool();

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE purchase_workflow_configs
     SET name = ?, enabled = ?, nodes = ?, updated_by = ?, updated_at = NOW(3)
     WHERE workflow_key = ?`,
    [
      normalized.name,
      normalized.enabled ? 1 : 0,
      JSON.stringify({
        nodes: normalized.nodes,
        edges: normalized.edges ?? [],
      }),
      operatorId,
      DEFAULT_WORKFLOW_KEY,
    ]
  );

  if (result.affectedRows === 0) {
    await pool.query(
      `INSERT INTO purchase_workflow_configs (id, workflow_key, name, enabled, nodes, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        DEFAULT_WORKFLOW_KEY,
        normalized.name,
        normalized.enabled ? 1 : 0,
        JSON.stringify({
          nodes: normalized.nodes,
          edges: normalized.edges ?? [],
        }),
        operatorId,
      ]
    );
  }

  return getPurchaseWorkflowConfig();
}

export async function listWorkflowApproverCandidates() {
  await ensurePurchasesSchema();
  await ensurePurchaseWorkflowSchema();
  const pool = mysqlPool();
  const [rows] = await pool.query<ApproverRow[]>(
    `SELECT id, display_name, email, primary_role, roles
     FROM hr_employees
     WHERE is_active = 1
     ORDER BY display_name ASC, email ASC
     LIMIT 300`
  );

  return rows.map((row) => {
    let roleList: string[] = [];
    try {
      const parsed = JSON.parse(row.roles ?? '[]');
      roleList = Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      roleList = [];
    }

    return {
      id: row.id,
      name: row.display_name || row.email || row.id,
      primaryRole: row.primary_role,
      roles: roleList,
    };
  });
}

function isNodeMatched(node: PurchaseWorkflowNode, context: WorkflowPurchaseContext): boolean {
  if (normalizeNodeType(node.nodeType) !== 'user_activity') return false;
  const min = node.condition?.minAmount;
  const max = node.condition?.maxAmount;
  const org = node.condition?.organizationType ?? 'all';

  if (typeof min === 'number' && Number.isFinite(min) && context.totalAmount < min) return false;
  if (typeof max === 'number' && Number.isFinite(max) && context.totalAmount > max) return false;
  if (org !== 'all' && org !== context.organizationType) return false;

  return true;
}

async function getEmployeeDepartment(employeeId: string): Promise<string | null> {
  const pool = mysqlPool();
  const [rows] = await pool.query<EmployeeDepartmentRow[]>(
    `SELECT department FROM hr_employees WHERE id = ? LIMIT 1`,
    [employeeId]
  );
  return rows[0]?.department ?? null;
}

async function findApproverByRole(role: string, purchaserDepartment: string | null): Promise<string | null> {
  const pool = mysqlPool();
  const isDepartmentManagerRole = role === UserRole.DEPARTMENT_MANAGER;

  if (isDepartmentManagerRole && purchaserDepartment) {
    const [sameDeptRows] = await pool.query<ApproverCandidateRow[]>(
      `SELECT id
       FROM hr_employees
       WHERE is_active = 1
         AND (primary_role = ? OR JSON_CONTAINS(roles, JSON_QUOTE(?), '$'))
         AND department = ?
       ORDER BY updated_at DESC, created_at ASC
       LIMIT 1`,
      [role, role, purchaserDepartment]
    );
    if (sameDeptRows[0]?.id) return sameDeptRows[0].id;
  }

  const [rows] = await pool.query<ApproverCandidateRow[]>(
    `SELECT id
     FROM hr_employees
     WHERE is_active = 1
       AND (primary_role = ? OR JSON_CONTAINS(roles, JSON_QUOTE(?), '$'))
     ORDER BY updated_at DESC, created_at ASC
     LIMIT 1`,
    [role, role]
  );
  return rows[0]?.id ?? null;
}

export async function buildWorkflowSnapshotForPurchase(
  context: WorkflowPurchaseContext
): Promise<PurchaseWorkflowNode[]> {
  const config = await getPurchaseWorkflowConfig();
  if (!config.enabled) return [];
  return config.nodes
    .filter((node) => normalizeNodeType(node.nodeType) === 'user_activity')
    .filter((node) => isNodeMatched(node, context));
}

export async function resolveWorkflowApproverForStep(
  workflowNodes: PurchaseWorkflowNode[],
  stepIndex: number,
  purchaserId: string
): Promise<string | null> {
  if (stepIndex < 0 || stepIndex >= workflowNodes.length) return null;
  const node = workflowNodes[stepIndex];
  if (node.approverType === 'user') {
    return node.approverUserId ?? null;
  }
  const role = node.approverRole ?? UserRole.ADMIN;
  const purchaserDepartment = await getEmployeeDepartment(purchaserId);
  return findApproverByRole(role, purchaserDepartment);
}
