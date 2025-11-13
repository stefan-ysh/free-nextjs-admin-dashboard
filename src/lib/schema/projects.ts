import { sql } from '@/lib/postgres';

let initialized = false;

/**
 * 项目管理表结构
 */
export async function ensureProjectsSchema() {
  if (initialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      -- ============ 核心字段 ============
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_code TEXT UNIQUE NOT NULL,
      project_name TEXT NOT NULL,
      description TEXT,
      
      -- ============ 客户和财务信息 ============
      client_name TEXT,
      contract_amount NUMERIC(15,2),
      budget NUMERIC(15,2),
      actual_cost NUMERIC(15,2) DEFAULT 0,
      
      -- ============ 时间信息 ============
      start_date DATE,
      end_date DATE,
      expected_end_date DATE,
      
      -- ============ 团队信息 ============
      project_manager_id UUID NOT NULL,
      team_member_ids UUID[] DEFAULT ARRAY[]::UUID[],
      
      -- ============ 状态 ============
      status TEXT NOT NULL DEFAULT 'planning',
      priority TEXT NOT NULL DEFAULT 'medium',
      
      -- ============ 审计字段 ============
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID NOT NULL,
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      deleted_at TIMESTAMPTZ
    )
  `;

  // 创建索引
  await sql`
    CREATE INDEX IF NOT EXISTS idx_projects_code 
    ON projects(project_code)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_projects_manager 
    ON projects(project_manager_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_projects_status 
    ON projects(status) 
    WHERE is_deleted = false
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_projects_created_by 
    ON projects(created_by)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_projects_start_date 
    ON projects(start_date DESC) 
    WHERE start_date IS NOT NULL
  `;

  // 添加约束
  await sql`
    DO $$
    BEGIN
      -- 项目状态约束
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_status_check'
      ) THEN
        ALTER TABLE projects
        ADD CONSTRAINT projects_status_check
        CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'archived', 'cancelled'));
      END IF;
      
      -- 优先级约束
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_priority_check'
      ) THEN
        ALTER TABLE projects
        ADD CONSTRAINT projects_priority_check
        CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
      END IF;
      
      -- 财务金额约束
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_amounts_check'
      ) THEN
        ALTER TABLE projects
        ADD CONSTRAINT projects_amounts_check
        CHECK (
          (contract_amount IS NULL OR contract_amount >= 0) AND
          (budget IS NULL OR budget >= 0) AND
          (actual_cost >= 0)
        );
      END IF;
      
      -- 外键：project_manager_id 引用 users 表
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_manager_fkey'
      ) THEN
        ALTER TABLE projects
        ADD CONSTRAINT projects_manager_fkey
        FOREIGN KEY (project_manager_id) REFERENCES users(id);
      END IF;
      
      -- 外键：created_by 引用 users 表
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_created_by_fkey'
      ) THEN
        ALTER TABLE projects
        ADD CONSTRAINT projects_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id);
      END IF;
    END
    $$
  `;

  initialized = true;
}
