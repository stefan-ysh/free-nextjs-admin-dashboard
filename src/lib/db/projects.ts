import { randomUUID } from 'crypto';
import { pool, sql } from '@/lib/postgres';
import { ensureProjectsSchema } from '@/lib/schema/projects';
import {
  ProjectRecord,
  ProjectStatus,
  ProjectPriority,
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsParams,
  ListProjectsResult,
  ProjectStats,
} from '@/types/project';

/**
 * 数据库行类型
 */
type RawProjectRow = {
  id: string;
  project_code: string;
  project_name: string;
  description: string | null;
  client_name: string | null;
  contract_amount: string | null;
  budget: string | null;
  actual_cost: string;
  start_date: string | null;
  end_date: string | null;
  expected_end_date: string | null;
  project_manager_id: string;
  team_member_ids: string[];
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  is_deleted: boolean;
  deleted_at: string | null;
};

/**
 * 映射数据库行到项目记录
 */
function mapProject(row: RawProjectRow | undefined): ProjectRecord | null {
  if (!row) return null;
  
  return {
    id: row.id,
    projectCode: row.project_code,
    projectName: row.project_name,
    description: row.description,
    clientName: row.client_name,
    contractAmount: row.contract_amount ? parseFloat(row.contract_amount) : null,
    budget: row.budget ? parseFloat(row.budget) : null,
    actualCost: parseFloat(row.actual_cost),
    startDate: row.start_date,
    endDate: row.end_date,
    expectedEndDate: row.expected_end_date,
    projectManagerId: row.project_manager_id,
    teamMemberIds: row.team_member_ids,
    status: row.status as ProjectStatus,
    priority: row.priority as ProjectPriority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
  };
}

/**
 * 生成项目编号
 */
async function generateProjectCode(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // 查询当月已有的项目数量
  const result = await sql<{ count: number }>`
    SELECT COUNT(*)::int as count
    FROM projects
    WHERE project_code LIKE ${'PRJ' + year + month + '%'}
  `;
  
  const sequence = (result.rows[0]?.count || 0) + 1;
  return `PRJ${year}${month}${String(sequence).padStart(3, '0')}`;
}

/**
 * 创建项目
 */
export async function createProject(
  input: CreateProjectInput,
  createdBy: string
): Promise<ProjectRecord> {
  await ensureProjectsSchema();
  
  // 检查项目编号是否已存在
  const existingCode = await sql`
    SELECT id FROM projects WHERE project_code = ${input.projectCode} LIMIT 1
  `;
  if (existingCode.rows.length > 0) {
    throw new Error('PROJECT_CODE_EXISTS');
  }
  
  const id = randomUUID();
  const projectCode = input.projectCode;
  const status = input.status ?? 'planning';
  const priority = input.priority ?? 'medium';
  const teamMemberIds = input.teamMemberIds ?? [];
  
  const result = await sql<RawProjectRow>`
    INSERT INTO projects (
      id, project_code, project_name, description,
      client_name, contract_amount, budget,
      start_date, end_date, expected_end_date,
      project_manager_id, team_member_ids,
      status, priority,
      created_by
    ) VALUES (
      ${id}, ${projectCode}, ${input.projectName}, ${input.description ?? null},
      ${input.clientName ?? null}, ${input.contractAmount ?? null}, ${input.budget ?? null},
      ${input.startDate ?? null}, ${input.endDate ?? null}, ${input.expectedEndDate ?? null},
      ${input.projectManagerId}, ${teamMemberIds},
      ${status}, ${priority},
      ${createdBy}
    )
    RETURNING *
  `;
  
  return mapProject(result.rows[0])!;
}

/**
 * 通过 ID 获取项目
 */
export async function findProjectById(id: string): Promise<ProjectRecord | null> {
  await ensureProjectsSchema();
  
  const result = await sql<RawProjectRow>`
    SELECT * FROM projects
    WHERE id = ${id}
    LIMIT 1
  `;
  
  return mapProject(result.rows[0]);
}

/**
 * 通过项目编号获取项目
 */
export async function findProjectByCode(projectCode: string): Promise<ProjectRecord | null> {
  await ensureProjectsSchema();
  
  const result = await sql<RawProjectRow>`
    SELECT * FROM projects
    WHERE project_code = ${projectCode}
    LIMIT 1
  `;
  
  return mapProject(result.rows[0]);
}

/**
 * 更新项目
 */
export async function updateProject(
  id: string,
  input: UpdateProjectInput
): Promise<ProjectRecord> {
  await ensureProjectsSchema();
  
  const updates: string[] = [];
  const values: unknown[] = [id];
  let paramIndex = 2;
  
  if (input.projectName !== undefined) {
    updates.push(`project_name = $${paramIndex++}`);
    values.push(input.projectName);
  }
  
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(input.description);
  }
  
  if (input.clientName !== undefined) {
    updates.push(`client_name = $${paramIndex++}`);
    values.push(input.clientName);
  }
  
  if (input.contractAmount !== undefined) {
    updates.push(`contract_amount = $${paramIndex++}`);
    values.push(input.contractAmount);
  }
  
  if (input.budget !== undefined) {
    updates.push(`budget = $${paramIndex++}`);
    values.push(input.budget);
  }
  
  if (input.startDate !== undefined) {
    updates.push(`start_date = $${paramIndex++}`);
    values.push(input.startDate);
  }
  
  if (input.endDate !== undefined) {
    updates.push(`end_date = $${paramIndex++}`);
    values.push(input.endDate);
  }
  
  if (input.expectedEndDate !== undefined) {
    updates.push(`expected_end_date = $${paramIndex++}`);
    values.push(input.expectedEndDate);
  }
  
  if (input.projectManagerId !== undefined) {
    updates.push(`project_manager_id = $${paramIndex++}`);
    values.push(input.projectManagerId);
  }
  
  if (input.teamMemberIds !== undefined) {
    updates.push(`team_member_ids = $${paramIndex++}`);
    values.push(input.teamMemberIds);
  }
  
  if (input.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(input.status);
  }
  
  if (input.priority !== undefined) {
    updates.push(`priority = $${paramIndex++}`);
    values.push(input.priority);
  }
  
  if (updates.length === 0) {
    const existing = await findProjectById(id);
    if (!existing) throw new Error('PROJECT_NOT_FOUND');
    return existing;
  }
  
  updates.push(`updated_at = NOW()`);
  
  const query = `
    UPDATE projects
    SET ${updates.join(', ')}
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await pool.query<RawProjectRow>(query, values);
  
  if (result.rows.length === 0) {
    throw new Error('PROJECT_NOT_FOUND');
  }
  
  return mapProject(result.rows[0])!;
}

/**
 * 更新项目实际成本（从采购记录汇总）
 */
export async function updateProjectActualCost(projectId: string): Promise<void> {
  await ensureProjectsSchema();
  
  await sql`
    UPDATE projects
    SET actual_cost = (
      SELECT COALESCE(SUM(total_amount), 0)
      FROM purchases
      WHERE project_id = ${projectId}
      AND status = 'paid'
      AND is_deleted = false
    ),
    updated_at = NOW()
    WHERE id = ${projectId}
  `;
}

/**
 * 删除项目（软删除）
 */
export async function deleteProject(id: string): Promise<void> {
  await ensureProjectsSchema();
  
  await sql`
    UPDATE projects
    SET is_deleted = true, deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${id}
  `;
}

/**
 * 恢复已删除的项目
 */
export async function restoreProject(id: string): Promise<void> {
  await ensureProjectsSchema();
  
  await sql`
    UPDATE projects
    SET is_deleted = false, deleted_at = NULL, updated_at = NOW()
    WHERE id = ${id}
  `;
}

/**
 * 列出项目
 */
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
  
  // 默认不显示已删除的项目
  if (!includeDeleted) {
    conditions.push('is_deleted = false');
  }
  
  // 搜索条件
  if (params.search) {
    const searchIndex = values.length + 1;
    values.push(`%${params.search.trim()}%`);
    conditions.push(`(
      project_code ILIKE $${searchIndex} OR
      project_name ILIKE $${searchIndex} OR
      client_name ILIKE $${searchIndex} OR
      description ILIKE $${searchIndex}
    )`);
  }
  
  // 状态筛选
  if (params.status && params.status !== 'all') {
    values.push(params.status);
    conditions.push(`status = $${values.length}`);
  }
  
  // 优先级筛选
  if (params.priority) {
    values.push(params.priority);
    conditions.push(`priority = $${values.length}`);
  }
  
  // 项目经理筛选
  if (params.projectManagerId) {
    values.push(params.projectManagerId);
    conditions.push(`project_manager_id = $${values.length}`);
  }
  
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderClause = `ORDER BY ${sortColumn} ${sortOrder}, id ASC`;
  const limitClause = `LIMIT $${values.length + 1}`;
  const offsetClause = `OFFSET $${values.length + 2}`;
  
  const dataValues = [...values, pageSize, (page - 1) * pageSize];
  
  const baseSelect = `SELECT * FROM projects`;
  const dataQuery = `${baseSelect} ${whereClause} ${orderClause} ${limitClause} ${offsetClause}`;
  const countQuery = `SELECT COUNT(*)::int AS total FROM projects ${whereClause}`;
  
  const [dataResult, countResult] = await Promise.all([
    pool.query<RawProjectRow>(dataQuery, dataValues),
    pool.query<{ total: number }>(countQuery, values),
  ]);
  
  return {
    items: dataResult.rows.map(row => mapProject(row)!),
    total: countResult.rows[0]?.total ?? 0,
    page,
    pageSize,
  };
}

/**
 * 获取项目统计信息
 */
export async function getProjectStats(): Promise<ProjectStats> {
  await ensureProjectsSchema();
  
  const result = await sql<{
    total_projects: number;
    active_projects: number;
    completed_projects: number;
    total_budget: string | null;
    total_actual_cost: string;
  }>`
    SELECT
      COUNT(*)::int as total_projects,
      COUNT(*) FILTER (WHERE status = 'active')::int as active_projects,
      COUNT(*) FILTER (WHERE status = 'completed')::int as completed_projects,
      SUM(budget) as total_budget,
      SUM(actual_cost) as total_actual_cost
    FROM projects
    WHERE is_deleted = false
  `;
  
  const row = result.rows[0];
  const totalBudget = row.total_budget ? parseFloat(row.total_budget) : 0;
  const totalActualCost = parseFloat(row.total_actual_cost || '0');
  
  return {
    totalProjects: row.total_projects,
    activeProjects: row.active_projects,
    completedProjects: row.completed_projects,
    totalBudget,
    totalActualCost,
    costUtilization: totalBudget > 0 ? (totalActualCost / totalBudget) * 100 : 0,
  };
}

/**
 * 获取用户参与的项目列表
 */
export async function getUserProjects(userId: string): Promise<ProjectRecord[]> {
  await ensureProjectsSchema();
  
  const result = await sql<RawProjectRow>`
    SELECT * FROM projects
    WHERE is_deleted = false
    AND (
      project_manager_id = ${userId}
      OR ${userId} = ANY(team_member_ids)
    )
    ORDER BY updated_at DESC
  `;
  
  return result.rows.map(row => mapProject(row)!);
}

/**
 * 获取项目团队成员数量
 */
export async function getProjectTeamSize(projectId: string): Promise<number> {
  await ensureProjectsSchema();
  
  const result = await sql<{ team_size: number }>`
    SELECT array_length(team_member_ids, 1) as team_size
    FROM projects
    WHERE id = ${projectId}
  `;
  
  return result.rows[0]?.team_size ?? 0;
}

/**
 * 添加团队成员
 */
export async function addTeamMember(
  projectId: string,
  userId: string
): Promise<ProjectRecord> {
  await ensureProjectsSchema();
  
  const result = await sql<RawProjectRow>`
    UPDATE projects
    SET
      team_member_ids = array_append(team_member_ids, ${userId}),
      updated_at = NOW()
    WHERE id = ${projectId}
    AND NOT (${userId} = ANY(team_member_ids))
    RETURNING *
  `;
  
  if (result.rows.length === 0) {
    throw new Error('PROJECT_NOT_FOUND_OR_MEMBER_EXISTS');
  }
  
  return mapProject(result.rows[0])!;
}

/**
 * 移除团队成员
 */
export async function removeTeamMember(
  projectId: string,
  userId: string
): Promise<ProjectRecord> {
  await ensureProjectsSchema();
  
  const result = await sql<RawProjectRow>`
    UPDATE projects
    SET
      team_member_ids = array_remove(team_member_ids, ${userId}),
      updated_at = NOW()
    WHERE id = ${projectId}
    RETURNING *
  `;
  
  if (result.rows.length === 0) {
    throw new Error('PROJECT_NOT_FOUND');
  }
  
  return mapProject(result.rows[0])!;
}
