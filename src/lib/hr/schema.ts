import type { RowDataPacket } from 'mysql2';

import { schemaPool, safeCreateIndex, ensureColumn, ensureForeignKey } from '@/lib/schema/mysql-utils';

let initialized = false;

async function hasColumn(table: string, column: string): Promise<boolean> {
  const pool = schemaPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function hasIndex(table: string, indexName: string): Promise<boolean> {
  const pool = schemaPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [table, indexName]
  );
  return rows.length > 0;
}

export async function ensureHrSchema() {
  if (initialized) return;

  const pool = schemaPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hr_departments (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      code VARCHAR(60),
      parent_id CHAR(36),
      description TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_hr_department_parent FOREIGN KEY (parent_id) REFERENCES hr_departments(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeCreateIndex('CREATE UNIQUE INDEX hr_departments_code_idx ON hr_departments(code)');
  await safeCreateIndex('CREATE INDEX hr_departments_parent_idx ON hr_departments(parent_id)');
  await safeCreateIndex('CREATE INDEX hr_departments_sort_order_idx ON hr_departments(sort_order)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hr_job_grades (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      code VARCHAR(60),
      level INT,
      description TEXT,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeCreateIndex('CREATE UNIQUE INDEX hr_job_grades_code_idx ON hr_job_grades(code)');
  await safeCreateIndex('CREATE INDEX hr_job_grades_level_idx ON hr_job_grades(level)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hr_employees (
      id CHAR(36) NOT NULL PRIMARY KEY,
      email VARCHAR(255),
      password_hash VARCHAR(255),
      roles JSON NOT NULL DEFAULT (JSON_ARRAY('employee')),
      primary_role VARCHAR(64) NOT NULL DEFAULT 'employee',
      display_name VARCHAR(255) NOT NULL,
      phone VARCHAR(60),
      employee_code VARCHAR(120),
      department VARCHAR(120),
      department_id CHAR(36),
      job_title VARCHAR(120),
      job_grade_id CHAR(36),
      national_id VARCHAR(64),
      gender VARCHAR(16),
      address TEXT,
      organization VARCHAR(255),
      education_background VARCHAR(160),
      employment_status ENUM('active','on_leave','terminated') NOT NULL DEFAULT 'active',
      hire_date DATE,
      termination_date DATE,
      manager_id CHAR(36),
      location VARCHAR(255),
      bio TEXT,
      city VARCHAR(120),
      country VARCHAR(120),
      postal_code VARCHAR(40),
      tax_id VARCHAR(120),
      social_links JSON NOT NULL DEFAULT (JSON_OBJECT()),
      custom_fields JSON NOT NULL DEFAULT (JSON_OBJECT()),
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      email_verified TINYINT(1) NOT NULL DEFAULT 0,
      created_by CHAR(36),
      last_login_at DATETIME(3),
      password_updated_at DATETIME(3),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT chk_hr_roles_json CHECK (JSON_TYPE(roles) = 'ARRAY'),
      CONSTRAINT chk_hr_primary_role CHECK (JSON_CONTAINS(roles, JSON_QUOTE(primary_role), '$')),
      CONSTRAINT fk_hr_manager FOREIGN KEY (manager_id) REFERENCES hr_employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_hr_created_by FOREIGN KEY (created_by) REFERENCES hr_employees(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hr_department_budgets (
      department_id CHAR(36) NOT NULL,
      budget_year INT NOT NULL,
      budget_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (department_id, budget_year),
      CONSTRAINT fk_hr_department_budget_department FOREIGN KEY (department_id) REFERENCES hr_departments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await ensureColumn('hr_employees', 'email', 'VARCHAR(255) NULL');
  await ensureColumn('hr_employees', 'password_hash', 'VARCHAR(255) NULL');
  await ensureColumn('hr_employees', 'roles', "JSON NOT NULL DEFAULT (JSON_ARRAY('employee'))");
  await ensureColumn('hr_employees', 'primary_role', "VARCHAR(64) NOT NULL DEFAULT 'employee'");
  await ensureColumn('hr_employees', 'display_name', "VARCHAR(255) NULL");
  await ensureColumn('hr_employees', 'bio', 'TEXT NULL');
  await ensureColumn('hr_employees', 'city', 'VARCHAR(120) NULL');
  await ensureColumn('hr_employees', 'country', 'VARCHAR(120) NULL');
  await ensureColumn('hr_employees', 'postal_code', 'VARCHAR(40) NULL');
  await ensureColumn('hr_employees', 'tax_id', 'VARCHAR(120) NULL');
  await ensureColumn('hr_employees', 'social_links', 'JSON NOT NULL DEFAULT (JSON_OBJECT())');
  await ensureColumn('hr_employees', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn('hr_employees', 'email_verified', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('hr_employees', 'created_by', 'CHAR(36) NULL');
  await ensureColumn('hr_employees', 'last_login_at', 'DATETIME(3) NULL');
  await ensureColumn('hr_employees', 'password_updated_at', 'DATETIME(3) NULL');
  await ensureColumn('hr_employees', 'failed_login_attempts', 'INT NOT NULL DEFAULT 0');
  await ensureColumn('hr_employees', 'locked_until', 'DATETIME(3) NULL');
  await ensureColumn('hr_employees', 'department_id', 'CHAR(36) NULL');
  await ensureColumn('hr_employees', 'job_grade_id', 'CHAR(36) NULL');
  await ensureColumn('hr_employees', 'national_id', 'VARCHAR(64) NULL');
  await ensureColumn('hr_employees', 'gender', 'VARCHAR(16) NULL');
  await ensureColumn('hr_employees', 'address', 'TEXT NULL');
  await ensureColumn('hr_employees', 'organization', 'VARCHAR(255) NULL');
  await ensureColumn('hr_employees', 'education_background', 'VARCHAR(160) NULL');
  await safeCreateIndex('CREATE UNIQUE INDEX hr_employees_employee_code_idx ON hr_employees(employee_code)');
  await safeCreateIndex('CREATE UNIQUE INDEX hr_employees_email_idx ON hr_employees(email)');
  try {
    await safeCreateIndex('CREATE UNIQUE INDEX hr_employees_phone_idx ON hr_employees(phone)');
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'ER_DUP_ENTRY') {
      throw error;
    }
    console.warn('[hr_employees] Duplicate phone detected; skip unique index creation.');
  }
  // Cleanup legacy wecom column/index from historical schema versions.
  if (await hasIndex('hr_employees', 'hr_employees_wecom_user_id_idx')) {
    try {
      await pool.query('DROP INDEX hr_employees_wecom_user_id_idx ON hr_employees');
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'ER_CANT_DROP_FIELD_OR_KEY' && code !== 'ER_LOCK_DEADLOCK') {
        throw error;
      }
    }
  }
  if (await hasColumn('hr_employees', 'wecom_user_id')) {
    try {
      await pool.query('ALTER TABLE hr_employees DROP COLUMN wecom_user_id');
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (
        code !== 'ER_BAD_FIELD_ERROR' &&
        code !== 'ER_CANT_DROP_FIELD_OR_KEY' &&
        code !== 'ER_LOCK_DEADLOCK'
      ) {
        throw error;
      }
    }
  }

  // Migrate legacy name columns into display_name, then physically drop old columns.
  const hasFirstName = await hasColumn('hr_employees', 'first_name');
  const hasLastName = await hasColumn('hr_employees', 'last_name');
  if (hasFirstName || hasLastName) {
    await pool.query(`
      UPDATE hr_employees
      SET display_name = COALESCE(
        NULLIF(TRIM(display_name), ''),
        NULLIF(TRIM(CONCAT(COALESCE(last_name, ''), COALESCE(first_name, ''))), ''),
        NULLIF(TRIM(first_name), ''),
        NULLIF(TRIM(last_name), ''),
        NULLIF(TRIM(email), ''),
        NULLIF(TRIM(employee_code), ''),
        id
      )
      WHERE display_name IS NULL OR TRIM(display_name) = ''
    `);
  }

  await pool.query(`
    UPDATE hr_employees
    SET display_name = COALESCE(
      NULLIF(TRIM(display_name), ''),
      NULLIF(TRIM(email), ''),
      NULLIF(TRIM(employee_code), ''),
      id
    )
    WHERE display_name IS NULL OR TRIM(display_name) = ''
  `);

  await pool.query(`ALTER TABLE hr_employees MODIFY COLUMN display_name VARCHAR(255) NOT NULL`);

  if (hasFirstName) {
    try {
      await pool.query('ALTER TABLE hr_employees DROP COLUMN first_name');
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'ER_BAD_FIELD_ERROR' && code !== 'ER_CANT_DROP_FIELD_OR_KEY' && code !== 'ER_LOCK_DEADLOCK') {
        throw error;
      }
    }
  }
  if (hasLastName) {
    try {
      await pool.query('ALTER TABLE hr_employees DROP COLUMN last_name');
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'ER_BAD_FIELD_ERROR' && code !== 'ER_CANT_DROP_FIELD_OR_KEY' && code !== 'ER_LOCK_DEADLOCK') {
        throw error;
      }
    }
  }
  await safeCreateIndex('CREATE INDEX hr_employees_department_idx ON hr_employees(department)');
  await safeCreateIndex('CREATE INDEX hr_employees_department_id_idx ON hr_employees(department_id)');
  await safeCreateIndex('CREATE INDEX hr_employees_status_idx ON hr_employees(employment_status)');
  await safeCreateIndex('CREATE INDEX hr_employees_job_grade_id_idx ON hr_employees(job_grade_id)');
  await safeCreateIndex('CREATE INDEX hr_employees_manager_idx ON hr_employees(manager_id)');
  await safeCreateIndex('CREATE INDEX hr_employees_active_idx ON hr_employees(is_active)');
  await safeCreateIndex('CREATE INDEX hr_employees_primary_role_idx ON hr_employees(primary_role)');
  await safeCreateIndex('CREATE INDEX hr_department_budgets_year_idx ON hr_department_budgets(budget_year)');
  await ensureForeignKey(
    'hr_employees',
    'fk_hr_department_link',
    'FOREIGN KEY (department_id) REFERENCES hr_departments(id) ON DELETE SET NULL'
  );
  await ensureForeignKey(
    'hr_employees',
    'fk_hr_job_grade_link',
    'FOREIGN KEY (job_grade_id) REFERENCES hr_job_grades(id) ON DELETE SET NULL'
  );
  await ensureForeignKey(
    'hr_employees',
    'fk_hr_manager_link',
    'FOREIGN KEY (manager_id) REFERENCES hr_employees(id) ON DELETE SET NULL'
  );
  await ensureForeignKey(
    'hr_employees',
    'fk_hr_created_by_link',
    'FOREIGN KEY (created_by) REFERENCES hr_employees(id) ON DELETE SET NULL'
  );
  await ensureColumn('hr_employees', 'custom_fields', 'JSON NOT NULL DEFAULT (JSON_OBJECT())');
  await ensureColumn('hr_employees', 'employee_code', 'VARCHAR(120) NULL');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hr_employee_status_logs (
      id CHAR(36) NOT NULL PRIMARY KEY,
      employee_id CHAR(36) NOT NULL,
      previous_status ENUM('active','on_leave','terminated') NOT NULL,
      next_status ENUM('active','on_leave','terminated') NOT NULL,
      note TEXT,
      actor_id CHAR(36),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_hr_status_employee FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE,
      CONSTRAINT fk_hr_status_actor FOREIGN KEY (actor_id) REFERENCES hr_employees(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeCreateIndex('CREATE INDEX hr_employee_status_logs_employee_idx ON hr_employee_status_logs(employee_id)');
  await safeCreateIndex('CREATE INDEX hr_employee_status_logs_created_idx ON hr_employee_status_logs(created_at)');

  initialized = true;
}
