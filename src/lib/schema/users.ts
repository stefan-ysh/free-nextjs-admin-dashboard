import { schemaPool, safeCreateIndex } from '@/lib/schema/mysql-utils';

let initialized = false;

export async function ensureUsersSchema() {
  if (initialized) return;

  const pool = schemaPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) NOT NULL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      roles JSON NOT NULL DEFAULT (JSON_ARRAY('employee')),
      primary_role VARCHAR(64) NOT NULL DEFAULT 'employee',
      first_name VARCHAR(120),
      last_name VARCHAR(120),
      display_name VARCHAR(255) NOT NULL,
      phone VARCHAR(60),
      avatar_url TEXT,
      employee_code VARCHAR(120) UNIQUE,
      department VARCHAR(120),
      job_title VARCHAR(120),
      employment_status ENUM('active','on_leave','terminated'),
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
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      created_by CHAR(36),
      last_login_at DATETIME(3),
      password_updated_at DATETIME(3),
      CONSTRAINT chk_users_roles_json CHECK (JSON_TYPE(roles) = 'ARRAY'),
      CONSTRAINT chk_users_primary_role CHECK (JSON_CONTAINS(roles, JSON_QUOTE(primary_role), '$')),
      CONSTRAINT chk_users_employee_consistency CHECK (
        employee_code IS NULL OR employment_status IS NOT NULL
      ),
      CONSTRAINT fk_users_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeCreateIndex('CREATE INDEX idx_users_email ON users(email)');
  await safeCreateIndex('CREATE INDEX idx_users_department ON users(department)');
  await safeCreateIndex('CREATE INDEX idx_users_status ON users(employment_status)');
  await safeCreateIndex('CREATE INDEX idx_users_manager ON users(manager_id)');
  await safeCreateIndex('CREATE INDEX idx_users_active ON users(is_active)');

  initialized = true;
}
