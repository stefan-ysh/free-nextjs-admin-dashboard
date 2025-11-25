import { schemaPool, safeCreateIndex, ensureColumn, ensureForeignKey } from '@/lib/schema/mysql-utils';
import { ensureUsersSchema } from '@/lib/schema/users';

let initialized = false;

export async function ensureHrSchema() {
  if (initialized) return;

  await ensureUsersSchema();
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
      user_id CHAR(36),
      employee_code VARCHAR(120),
      first_name VARCHAR(120) NOT NULL,
      last_name VARCHAR(120) NOT NULL,
      display_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(60),
      department VARCHAR(120),
      department_id CHAR(36),
      job_title VARCHAR(120),
      job_grade_id CHAR(36),
      avatar_url TEXT,
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
      custom_fields JSON NOT NULL DEFAULT (JSON_OBJECT()),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_hr_manager FOREIGN KEY (manager_id) REFERENCES hr_employees(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await ensureColumn('hr_employees', 'user_id', 'CHAR(36) NULL');
  await ensureColumn('hr_employees', 'department_id', 'CHAR(36) NULL');
  await ensureColumn('hr_employees', 'job_grade_id', 'CHAR(36) NULL');
  await ensureColumn('hr_employees', 'national_id', 'VARCHAR(64) NULL');
  await ensureColumn('hr_employees', 'gender', 'VARCHAR(16) NULL');
  await ensureColumn('hr_employees', 'address', 'TEXT NULL');
  await ensureColumn('hr_employees', 'organization', 'VARCHAR(255) NULL');
  await ensureColumn('hr_employees', 'education_background', 'VARCHAR(160) NULL');
  await safeCreateIndex('CREATE UNIQUE INDEX hr_employees_employee_code_idx ON hr_employees(employee_code)');
  await safeCreateIndex('CREATE INDEX hr_employees_department_idx ON hr_employees(department)');
  await safeCreateIndex('CREATE INDEX hr_employees_department_id_idx ON hr_employees(department_id)');
  await safeCreateIndex('CREATE INDEX hr_employees_status_idx ON hr_employees(employment_status)');
  await safeCreateIndex('CREATE INDEX hr_employees_job_grade_id_idx ON hr_employees(job_grade_id)');
  await safeCreateIndex('CREATE UNIQUE INDEX hr_employees_user_id_idx ON hr_employees(user_id)');
  await ensureForeignKey(
    'hr_employees',
    'fk_hr_user_link',
    'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL'
  );
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
      CONSTRAINT fk_hr_status_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeCreateIndex('CREATE INDEX hr_employee_status_logs_employee_idx ON hr_employee_status_logs(employee_id)');
  await safeCreateIndex('CREATE INDEX hr_employee_status_logs_created_idx ON hr_employee_status_logs(created_at)');

  initialized = true;
}
