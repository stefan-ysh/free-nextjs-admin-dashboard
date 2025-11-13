import { sql } from '@/lib/postgres';

let initialized = false;

/**
 * 统一的用户表结构
 * 合并原有的 auth_users 和 hr_employees，支持多角色
 */
export async function ensureUsersSchema() {
  if (initialized) return;

  // 创建统一的 users 表
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      -- ============ 核心字段 ============
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      
      -- ============ 角色权限（支持多角色）============
      roles TEXT[] NOT NULL DEFAULT ARRAY['employee']::TEXT[],
      primary_role TEXT NOT NULL DEFAULT 'employee',
      
      -- ============ 基本信息 ============
      first_name TEXT,
      last_name TEXT,
      display_name TEXT NOT NULL,
      phone TEXT,
      avatar_url TEXT,
      
      -- ============ 员工信息（可选）============
      employee_code TEXT UNIQUE,
      department TEXT,
      job_title TEXT,
      employment_status TEXT,
      hire_date DATE,
      termination_date DATE,
      manager_id UUID,
      location TEXT,
      
      -- ============ 扩展信息 ============
      bio TEXT,
      city TEXT,
      country TEXT,
      postal_code TEXT,
      tax_id TEXT,
      social_links JSONB DEFAULT '{}'::jsonb,
      custom_fields JSONB DEFAULT '{}'::jsonb,
      
      -- ============ 状态 ============
      is_active BOOLEAN NOT NULL DEFAULT true,
      email_verified BOOLEAN NOT NULL DEFAULT false,
      
      -- ============ 审计字段 ============
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID,
      last_login_at TIMESTAMPTZ,
      password_updated_at TIMESTAMPTZ
    )
  `;

  // 创建索引
  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_email 
    ON users(email)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_roles 
    ON users USING GIN(roles)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_active 
    ON users(is_active) 
    WHERE is_active = true
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_employee_code 
    ON users(employee_code) 
    WHERE employee_code IS NOT NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_department 
    ON users(department) 
    WHERE department IS NOT NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_employment_status 
    ON users(employment_status) 
    WHERE employment_status IS NOT NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_manager 
    ON users(manager_id) 
    WHERE manager_id IS NOT NULL
  `;

  // 添加约束
  await sql`
    DO $$
    BEGIN
      -- 角色数组不能为空
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_roles_not_empty'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_roles_not_empty
        CHECK (array_length(roles, 1) > 0);
      END IF;
      
      -- primary_role 必须在 roles 数组中
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_primary_role_in_roles'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_primary_role_in_roles
        CHECK (primary_role = ANY(roles));
      END IF;
      
      -- 员工字段一致性：如果有 employee_code，必须有 employment_status
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_employee_consistency'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_employee_consistency
        CHECK (
          (employee_code IS NULL) OR 
          (employee_code IS NOT NULL AND employment_status IS NOT NULL)
        );
      END IF;
      
      -- employment_status 只能是指定值
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_employment_status_check'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_employment_status_check
        CHECK (
          employment_status IS NULL OR 
          employment_status IN ('active', 'on_leave', 'terminated')
        );
      END IF;
      
      -- 外键：manager_id 引用 users 表
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_manager_fkey'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_manager_fkey
        FOREIGN KEY (manager_id) REFERENCES users(id);
      END IF;
      
      -- 外键：created_by 引用 users 表
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_created_by_fkey'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id);
      END IF;
    END
    $$
  `;

  // 创建 auth_sessions 表（与 users 关联）
  await sql`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_token TEXT NOT NULL UNIQUE,
      device_type TEXT NOT NULL,
      user_agent_hash TEXT NOT NULL,
      user_agent TEXT,
      remember_me BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id 
    ON auth_sessions(user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_token 
    ON auth_sessions(session_token)
  `;

  initialized = true;
}

/**
 * 数据迁移函数：从旧表迁移到新表
 * 注意：这个函数应该只运行一次，用于迁移现有数据
 */
export async function migrateFromOldTables() {
  // 检查旧表是否存在
  const oldAuthUsersExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'auth_users'
    )
  `;

  const oldHrEmployeesExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'hr_employees'
    )
  `;

  if (!oldAuthUsersExists.rows[0].exists) {
    console.log('✓ 旧表 auth_users 不存在，无需迁移');
    return;
  }

  console.log('🔄 开始数据迁移...');

  // 迁移 auth_users 到 users
  await sql`
    INSERT INTO users (
      id, email, password_hash, roles, primary_role,
      first_name, last_name, display_name, phone, avatar_url,
      bio, city, country, postal_code, tax_id, social_links,
      is_active, email_verified, created_at, updated_at, password_updated_at
    )
    SELECT 
      id, email, password_hash,
      ARRAY[role]::TEXT[] as roles,  -- 单角色转数组
      role as primary_role,
      first_name, last_name, display_name, phone, avatar_url,
      bio, city, country, postal_code, tax_id, 
      COALESCE(social_links, '{}'::jsonb),
      true as is_active,
      false as email_verified,
      created_at, updated_at, password_updated_at
    FROM auth_users
    ON CONFLICT (id) DO NOTHING
  `;

  // 如果有 hr_employees 表，更新对应用户的员工信息
  if (oldHrEmployeesExists.rows[0].exists) {
    await sql`
      UPDATE users u
      SET
        employee_code = e.employee_code,
        department = e.department,
        job_title = e.job_title,
        employment_status = e.employment_status,
        hire_date = e.hire_date,
        termination_date = e.termination_date,
        manager_id = e.manager_id,
        location = e.location,
        custom_fields = COALESCE(e.custom_fields, '{}'::jsonb)
      FROM hr_employees e
      WHERE u.email = e.email
      AND e.email IS NOT NULL
    `;
  }

  // 迁移 sessions
  await sql`
    INSERT INTO auth_sessions (
      id, user_id, session_token, device_type, user_agent_hash,
      user_agent, remember_me, created_at, expires_at, last_active
    )
    SELECT 
      id, user_id, session_token, device_type, user_agent_hash,
      user_agent, remember_me, created_at, expires_at, last_active
    FROM auth_sessions
    WHERE EXISTS (SELECT 1 FROM users WHERE id = user_id)
    ON CONFLICT (id) DO NOTHING
  `;

  console.log('✓ 数据迁移完成');
  console.log('⚠️  请手动备份并删除旧表: auth_users, hr_employees');
}
