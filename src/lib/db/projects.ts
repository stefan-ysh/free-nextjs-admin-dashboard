import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { mysqlPool, mysqlQuery } from '@/lib/mysql';
import { ensureProjectsSchema } from '@/lib/schema/projects';
import { normalizeDateInput } from '@/lib/dates';
import {
  ProjectRecord,
  ProjectStatus,
  ProjectPriority,
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsParams,
  ListProjectsResult,
  ProjectStats,
  ContractType,
  CurrencyCode,
  ContractRiskLevel,
  ProjectMilestone,
  MilestoneStatus,
} from '@/types/project';
import { findUserById } from '@/lib/users';

const pool = mysqlPool();

export type ClientSuggestion = {
  name: string;
  projectCount: number;
  lastProjectAt: string | null;
};

type RawProjectRow = RowDataPacket & {
  id: string;
  project_code: string;
  project_name: string;
  description: string | null;
  client_name: string | null;
  contract_amount: number | null;
  budget: number | null;
  actual_cost: number | null;
  contract_number: string | null;
  contract_type: string | null;
  signing_date: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  party_a: string | null;
  party_b: string | null;
  currency: string | null;
  tax_rate: number | null;
  payment_terms: string | null;
  risk_level: string | null;
  attachments: string | null;
  milestones: string | null;
  start_date: string | null;
  end_date: string | null;
  expected_end_date: string | null;
  project_manager_id: string;
  team_member_ids: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  is_deleted: number;
  deleted_at: string | null;
};

function parseTeamMembers(value: RawProjectRow['team_member_ids']): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
    } catch (error) {
      console.warn('Failed to parse team_member_ids JSON', error);
    }
  }
  return [];
}

function parseStringArray(value: RawProjectRow['attachments']): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
    } catch (error) {
      console.warn('Failed to parse JSON column', error);
    }
  }
  return [];
}

const CONTRACT_TYPES: ContractType[] = ['service', 'purchase', 'maintenance', 'consulting', 'other'];
const CURRENCY_CODES: CurrencyCode[] = ['CNY', 'USD', 'HKD', 'EUR', 'JPY', 'GBP', 'OTHER'];
const RISK_LEVELS: ContractRiskLevel[] = ['low', 'medium', 'high'];
const MILESTONE_STATUSES: MilestoneStatus[] = ['pending', 'in_progress', 'completed', 'delayed'];

function sanitizeText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeContractTypeValue(value: string | null | undefined): ContractType | null {
  if (!value) return null;
  return CONTRACT_TYPES.includes(value as ContractType) ? (value as ContractType) : 'other';
}

function normalizeCurrency(value: string | null | undefined): CurrencyCode {
  if (!value) return 'CNY';
  const upper = value.toUpperCase() as CurrencyCode;
  return CURRENCY_CODES.includes(upper) ? upper : 'OTHER';
}

function normalizeRiskLevel(value: string | null | undefined): ContractRiskLevel {
  if (!value) return 'medium';
  return RISK_LEVELS.includes(value as ContractRiskLevel) ? (value as ContractRiskLevel) : 'medium';
}

function clampTaxRate(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  const numeric = Number(value);
  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return Number(numeric.toFixed(2));
}

function parseMilestones(value: RawProjectRow['milestones']): ProjectMilestone[] {
  if (!value) return [];
  let raw: unknown;
  if (Array.isArray(value)) {
    raw = value;
  } else if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch (error) {
      console.warn('Failed to parse milestones JSON', error);
      return [];
    }
  } else {
    raw = value;
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item !== 'object' || !item) return null;
      const record = item as Partial<ProjectMilestone> & { id?: string };
      const title = sanitizeText(record.title ?? null);
      if (!title) return null;
      const dueDate = normalizeProjectDate(record.dueDate ?? null);
      const amount = record.amount == null || Number.isNaN(record.amount) ? null : Number(record.amount);
      const status = MILESTONE_STATUSES.includes(record.status as MilestoneStatus)
        ? (record.status as MilestoneStatus)
        : 'pending';
      return {
        id: sanitizeText(record.id ?? null) ?? randomUUID(),
        title,
        description: sanitizeText(record.description ?? null),
        dueDate,
        amount,
        status,
      };
    })
    .filter(Boolean) as ProjectMilestone[];
}

function serializeStringArray(value?: string[] | null): string {
  if (!value?.length) return JSON.stringify([]);
  return JSON.stringify(value.map((item) => sanitizeText(item) ?? '').filter(Boolean));
}

function sanitizeMilestones(value?: ProjectMilestone[] | null): ProjectMilestone[] {
  if (!value?.length) return [];
  return value
    .map((milestone) => {
      const title = sanitizeText(milestone?.title ?? null);
      if (!title) return null;
      const dueDate = normalizeProjectDate(milestone?.dueDate ?? null);
      const amount = milestone?.amount == null || Number.isNaN(milestone.amount) ? null : Number(milestone.amount);
      const status = MILESTONE_STATUSES.includes(milestone?.status as MilestoneStatus)
        ? (milestone?.status as MilestoneStatus)
        : 'pending';
      return {
        id: sanitizeText(milestone?.id ?? null) ?? randomUUID(),
        title,
        description: sanitizeText(milestone?.description ?? null),
        dueDate,
        amount,
        status,
      };
    })
    .filter(Boolean) as ProjectMilestone[];
}

function serializeMilestones(value?: ProjectMilestone[] | null): string {
  return JSON.stringify(sanitizeMilestones(value));
}

function mapProject(row: RawProjectRow | undefined): ProjectRecord | null {
  if (!row) return null;
  const teamMemberIds = parseTeamMembers(row.team_member_ids);

  return {
    id: row.id,
    projectCode: row.project_code,
    projectName: row.project_name,
    description: row.description,
    clientName: row.client_name,
    contractAmount: row.contract_amount ?? null,
    budget: row.budget ?? null,
    actualCost: row.actual_cost ?? 0,
    contractNumber: row.contract_number ?? null,
    contractType: normalizeContractTypeValue(row.contract_type),
    signingDate: row.signing_date,
    effectiveDate: row.effective_date,
    expirationDate: row.expiration_date,
    partyA: row.party_a,
    partyB: row.party_b,
    currency: normalizeCurrency(row.currency),
    taxRate: Number(row.tax_rate ?? 0),
    paymentTerms: row.payment_terms,
    riskLevel: normalizeRiskLevel(row.risk_level),
    attachments: parseStringArray(row.attachments),
    milestones: parseMilestones(row.milestones),
    startDate: row.start_date,
    endDate: row.end_date,
    expectedEndDate: row.expected_end_date,
    projectManagerId: row.project_manager_id,
    teamMemberIds,
    status: row.status as ProjectStatus,
    priority: row.priority as ProjectPriority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    isDeleted: Boolean(row.is_deleted),
    deletedAt: row.deleted_at,
  };
}

async function generateProjectCode(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `PRJ${year}${month}`;

  const result = await mysqlQuery<RowDataPacket & { count: number }>`
    SELECT COUNT(*) AS count
    FROM projects
    WHERE project_code LIKE ${prefix + '%'}
  `;

  const sequence = (result.rows[0]?.count ?? 0) + 1;
  return `${prefix}${String(sequence).padStart(3, '0')}`;
}

function serializeMembers(members: string[]): string {
  return JSON.stringify(members);
}

function normalizeProjectDate(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return normalizeDateInput(trimmed, { errorCode: 'INVALID_PROJECT_DATE' });
}

export async function createProject(
  input: CreateProjectInput,
  createdBy: string
): Promise<ProjectRecord> {
  await ensureProjectsSchema();

  const manager = await findUserById(input.projectManagerId);
  if (!manager) {
    throw new Error('PROJECT_MANAGER_NOT_FOUND');
  }

  const projectCode = input.projectCode || (await generateProjectCode());
  const existing = await mysqlQuery<RowDataPacket & { id: string }>`
    SELECT id FROM projects WHERE project_code = ${projectCode} LIMIT 1
  `;
  if (existing.rows.length > 0) {
    throw new Error('PROJECT_CODE_EXISTS');
  }

  const contractNumber = sanitizeText(input.contractNumber);
  if (contractNumber) {
    const contractNumberExists = await mysqlQuery<RowDataPacket & { id: string }>`
      SELECT id FROM projects WHERE contract_number = ${contractNumber} LIMIT 1
    `;
    if (contractNumberExists.rows.length > 0) {
      throw new Error('CONTRACT_NUMBER_EXISTS');
    }
  }

  const id = randomUUID();
  const teamMemberIds = input.teamMemberIds ?? [];
  const startDate = normalizeProjectDate(input.startDate ?? null);
  const endDate = normalizeProjectDate(input.endDate ?? null);
  const expectedEndDate = normalizeProjectDate(input.expectedEndDate ?? null);
  const signingDate = normalizeProjectDate(input.signingDate ?? null);
  const effectiveDate = normalizeProjectDate(input.effectiveDate ?? null);
  const expirationDate = normalizeProjectDate(input.expirationDate ?? null);
  const contractType = normalizeContractTypeValue(input.contractType);
  const partyA = sanitizeText(input.partyA);
  const partyB = sanitizeText(input.partyB);
  const currency = normalizeCurrency(input.currency);
  const taxRate = clampTaxRate(input.taxRate);
  const paymentTerms = sanitizeText(input.paymentTerms);
  const riskLevel = normalizeRiskLevel(input.riskLevel);
  const attachments = serializeStringArray(input.attachments);
  const milestones = serializeMilestones(input.milestones);
  await mysqlQuery`
    INSERT INTO projects (
      id, project_code, project_name, description,
      client_name, contract_amount, budget,
      contract_number, contract_type,
      signing_date, effective_date, expiration_date,
      party_a, party_b, currency, tax_rate, payment_terms, risk_level,
      attachments, milestones,
      start_date, end_date, expected_end_date,
      project_manager_id, team_member_ids,
      status, priority, created_by
    ) VALUES (
      ${id}, ${projectCode}, ${input.projectName}, ${input.description ?? null},
      ${input.clientName ?? null}, ${input.contractAmount ?? null}, ${input.budget ?? null},
      ${contractNumber}, ${contractType},
      ${signingDate}, ${effectiveDate}, ${expirationDate},
      ${partyA}, ${partyB}, ${currency}, ${taxRate}, ${paymentTerms}, ${riskLevel},
      ${attachments}, ${milestones},
      ${startDate}, ${endDate}, ${expectedEndDate},
      ${input.projectManagerId}, ${serializeMembers(teamMemberIds)},
      ${input.status ?? 'planning'}, ${input.priority ?? 'medium'}, ${createdBy}
    )
  `;

  return (await findProjectById(id))!;
}

export async function findProjectById(id: string): Promise<ProjectRecord | null> {
  await ensureProjectsSchema();
  const [rows] = await pool.query<RawProjectRow[]>(
    'SELECT * FROM projects WHERE id = ? LIMIT 1',
    [id]
  );
  return mapProject(rows[0]);
}

export async function findProjectByCode(projectCode: string): Promise<ProjectRecord | null> {
  await ensureProjectsSchema();
  const [rows] = await pool.query<RawProjectRow[]>(
    'SELECT * FROM projects WHERE project_code = ? LIMIT 1',
    [projectCode]
  );
  return mapProject(rows[0]);
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput
): Promise<ProjectRecord> {
  await ensureProjectsSchema();
  const existing = await findProjectById(id);
  if (!existing) throw new Error('PROJECT_NOT_FOUND');

  const updates: string[] = [];
  const values: unknown[] = [];
  const push = (column: string, value: unknown) => {
    updates.push(`${column} = ?`);
    values.push(value);
  };

  if (input.projectName !== undefined) push('project_name', input.projectName);
  if (input.description !== undefined) push('description', input.description);
  if (input.clientName !== undefined) push('client_name', input.clientName);
  if (input.contractAmount !== undefined) push('contract_amount', input.contractAmount);
  if (input.budget !== undefined) push('budget', input.budget);
  if (input.contractNumber !== undefined) {
    const sanitized = sanitizeText(input.contractNumber);
    if (sanitized) {
      const duplicate = await mysqlQuery<RowDataPacket & { id: string }>`
        SELECT id FROM projects WHERE contract_number = ${sanitized} AND id <> ${id} LIMIT 1
      `;
      if (duplicate.rows.length > 0) {
        throw new Error('CONTRACT_NUMBER_EXISTS');
      }
    }
    push('contract_number', sanitized);
  }
  if (input.contractType !== undefined) {
    push('contract_type', input.contractType ? normalizeContractTypeValue(input.contractType) : null);
  }
  if (input.signingDate !== undefined) push('signing_date', normalizeProjectDate(input.signingDate));
  if (input.effectiveDate !== undefined) push('effective_date', normalizeProjectDate(input.effectiveDate));
  if (input.expirationDate !== undefined) push('expiration_date', normalizeProjectDate(input.expirationDate));
  if (input.partyA !== undefined) push('party_a', sanitizeText(input.partyA));
  if (input.partyB !== undefined) push('party_b', sanitizeText(input.partyB));
  if (input.currency !== undefined) push('currency', normalizeCurrency(input.currency));
  if (input.taxRate !== undefined) push('tax_rate', clampTaxRate(input.taxRate));
  if (input.paymentTerms !== undefined) push('payment_terms', sanitizeText(input.paymentTerms));
  if (input.riskLevel !== undefined) push('risk_level', normalizeRiskLevel(input.riskLevel));
  if (input.attachments !== undefined) push('attachments', serializeStringArray(input.attachments));
  if (input.milestones !== undefined) push('milestones', serializeMilestones(input.milestones));
  if (input.startDate !== undefined) push('start_date', normalizeProjectDate(input.startDate));
  if (input.endDate !== undefined) push('end_date', normalizeProjectDate(input.endDate));
  if (input.expectedEndDate !== undefined) push('expected_end_date', normalizeProjectDate(input.expectedEndDate));
  if (input.projectManagerId !== undefined) push('project_manager_id', input.projectManagerId);
  if (input.teamMemberIds !== undefined) push('team_member_ids', serializeMembers(input.teamMemberIds));
  if (input.status !== undefined) push('status', input.status);
  if (input.priority !== undefined) push('priority', input.priority);
  if (input.projectManagerId !== undefined) {
    const manager = await findUserById(input.projectManagerId);
    if (!manager) {
      throw new Error('PROJECT_MANAGER_NOT_FOUND');
    }
    push('project_manager_id', input.projectManagerId);
  }

  if (!updates.length) {
    return existing;
  }

  updates.push('updated_at = NOW()');
  values.push(id);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  if (result.affectedRows === 0) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  return (await findProjectById(id))!;
}

export async function updateProjectActualCost(projectId: string): Promise<void> {
  await ensureProjectsSchema();
  await mysqlQuery`
    UPDATE projects
    SET actual_cost = (
      SELECT IFNULL(SUM(total_amount), 0)
      FROM purchases
      WHERE project_id = ${projectId}
        AND status = 'paid'
        AND is_deleted = 0
    ),
    updated_at = NOW()
    WHERE id = ${projectId}
  `;
}

export async function deleteProject(id: string): Promise<void> {
  await ensureProjectsSchema();
  await mysqlQuery`
    UPDATE projects
    SET is_deleted = 1, deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function restoreProject(id: string): Promise<void> {
  await ensureProjectsSchema();
  await mysqlQuery`
    UPDATE projects
    SET is_deleted = 0, deleted_at = NULL, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function listProjects(
  params: ListProjectsParams = {}
): Promise<ListProjectsResult> {
  await ensureProjectsSchema();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), 100);
  const sortBy = params.sortBy ?? 'updatedAt';
  const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const includeDeleted = params.includeDeleted ?? false;

  const sortColumnMap: Record<string, string> = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    startDate: 'start_date',
    projectName: 'project_name',
    status: 'status',
  };
  const sortColumn = sortColumnMap[sortBy] || 'updated_at';

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (!includeDeleted) {
    conditions.push('is_deleted = 0');
  }

  if (params.search) {
    const search = `%${params.search.trim().toLowerCase()}%`;
    conditions.push(
      '(' +
        'LOWER(project_code) LIKE ? OR ' +
        'LOWER(project_name) LIKE ? OR ' +
        'LOWER(client_name) LIKE ? OR ' +
        'LOWER(description) LIKE ? OR ' +
        'LOWER(contract_number) LIKE ? OR ' +
        'LOWER(party_a) LIKE ? OR ' +
        'LOWER(party_b) LIKE ?' +
      ')'
    );
    values.push(search, search, search, search, search, search, search);
  }

  if (params.status && params.status !== 'all') {
    conditions.push('status = ?');
    values.push(params.status);
  }

  if (params.priority) {
    conditions.push('priority = ?');
    values.push(params.priority);
  }

  if (params.projectManagerId) {
    conditions.push('project_manager_id = ?');
    values.push(params.projectManagerId);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderClause = `ORDER BY ${sortColumn} ${sortOrder}, id ASC`;

  const dataParams = [...values, pageSize, (page - 1) * pageSize];
  const [dataRows, countRows] = await Promise.all([
    pool.query<RawProjectRow[]>(
      `SELECT * FROM projects ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
      dataParams
    ),
    pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM projects ${whereClause}`,
      values
    ),
  ]);

  const totalRaw = countRows[0][0]?.total ?? countRows[0][0]?.['COUNT(*)'] ?? 0;

  return {
    items: dataRows[0].map((row) => mapProject(row)!).filter(Boolean),
    total: Number(totalRaw),
    page,
    pageSize,
  };
}

export async function listClientSuggestions(params: { search?: string; limit?: number } = {}): Promise<ClientSuggestion[]> {
  await ensureProjectsSchema();
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  const conditions = ['client_name IS NOT NULL', "client_name <> ''"];
  const values: unknown[] = [];
  if (params.search) {
    conditions.push('LOWER(client_name) LIKE ?');
    values.push(`%${params.search.trim().toLowerCase()}%`);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query<Array<RowDataPacket & { client_name: string; project_count: number; last_project_at: string | null }>>(
    `
      SELECT client_name, COUNT(*) AS project_count, MAX(updated_at) AS last_project_at
      FROM projects
      ${whereClause}
      GROUP BY client_name
      ORDER BY MAX(updated_at) DESC, client_name ASC
      LIMIT ?
    `,
    [...values, limit]
  );
  return rows
    .map((row) => ({
      name: row.client_name,
      projectCount: Number(row.project_count ?? 0),
      lastProjectAt: row.last_project_at,
    }))
    .filter((item) => Boolean(item.name && item.name.trim()));
}

export async function getProjectStats(): Promise<ProjectStats> {
  await ensureProjectsSchema();
  const result = await mysqlQuery<RowDataPacket & {
    total_projects: number;
    active_projects: number;
    completed_projects: number;
    total_budget: number | null;
    total_actual_cost: number | null;
  }>`
    SELECT
      COUNT(*) AS total_projects,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_projects,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_projects,
      SUM(budget) AS total_budget,
      SUM(actual_cost) AS total_actual_cost
    FROM projects
    WHERE is_deleted = 0
  `;

  const row = result.rows[0] ?? {
    total_projects: 0,
    active_projects: 0,
    completed_projects: 0,
    total_budget: 0,
    total_actual_cost: 0,
  };

  const totalBudget = row.total_budget ?? 0;
  const totalActualCost = row.total_actual_cost ?? 0;

  return {
    totalProjects: row.total_projects ?? 0,
    activeProjects: row.active_projects ?? 0,
    completedProjects: row.completed_projects ?? 0,
    totalBudget,
    totalActualCost,
    costUtilization: totalBudget > 0 ? (totalActualCost / totalBudget) * 100 : 0,
  };
}

export async function getUserProjects(userId: string): Promise<ProjectRecord[]> {
  await ensureProjectsSchema();
  const result = await mysqlQuery<RawProjectRow>`
    SELECT * FROM projects
    WHERE is_deleted = 0
      AND (
        project_manager_id = ${userId}
        OR JSON_CONTAINS(team_member_ids, JSON_QUOTE(${userId}), '$')
      )
    ORDER BY updated_at DESC
  `;
  return result.rows.map((row) => mapProject(row)!).filter(Boolean);
}

export async function getProjectTeamSize(projectId: string): Promise<number> {
  await ensureProjectsSchema();
  const result = await mysqlQuery<RowDataPacket & { team_size: number | null }>`
    SELECT JSON_LENGTH(team_member_ids) AS team_size
    FROM projects
    WHERE id = ${projectId}
  `;
  return result.rows[0]?.team_size ?? 0;
}

export async function addTeamMember(
  projectId: string,
  userId: string
): Promise<ProjectRecord> {
  await ensureProjectsSchema();
  const project = await findProjectById(projectId);
  if (!project) throw new Error('PROJECT_NOT_FOUND');
  if (project.teamMemberIds.includes(userId)) {
    throw new Error('MEMBER_ALREADY_EXISTS');
  }
  const updatedMembers = [...project.teamMemberIds, userId];
  await mysqlQuery`
    UPDATE projects
    SET team_member_ids = ${serializeMembers(updatedMembers)}, updated_at = NOW()
    WHERE id = ${projectId}
  `;
  return (await findProjectById(projectId))!;
}

export async function removeTeamMember(
  projectId: string,
  userId: string
): Promise<ProjectRecord> {
  await ensureProjectsSchema();
  const project = await findProjectById(projectId);
  if (!project) throw new Error('PROJECT_NOT_FOUND');
  const updatedMembers = project.teamMemberIds.filter((member) => member !== userId);
  await mysqlQuery`
    UPDATE projects
    SET team_member_ids = ${serializeMembers(updatedMembers)}, updated_at = NOW()
    WHERE id = ${projectId}
  `;
  return (await findProjectById(projectId))!;
}
