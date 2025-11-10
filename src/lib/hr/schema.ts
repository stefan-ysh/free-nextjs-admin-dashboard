import { sql } from '@/lib/postgres';

let initialized = false;

/**
 * Ensures HR related tables exist.
 */
export async function ensureHrSchema() {
  if (initialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS hr_employees (
      id UUID PRIMARY KEY,
      employee_code TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      display_name TEXT,
      email TEXT,
      phone TEXT,
      department TEXT,
      job_title TEXT,
      employment_status TEXT NOT NULL DEFAULT 'active',
      hire_date DATE,
      termination_date DATE,
      manager_id UUID,
      location TEXT,
      custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS hr_employees_employee_code_idx
    ON hr_employees (employee_code)
    WHERE employee_code IS NOT NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS hr_employees_department_idx
    ON hr_employees (department)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS hr_employees_status_idx
    ON hr_employees (employment_status)
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'hr_employees_status_check'
      ) THEN
        ALTER TABLE hr_employees
        ADD CONSTRAINT hr_employees_status_check
        CHECK (employment_status IN ('active', 'on_leave', 'terminated'));
      END IF;
    END
    $$
  `;

  await sql`
    ALTER TABLE hr_employees
    ALTER COLUMN custom_fields SET DEFAULT '{}'::jsonb
  `;

  initialized = true;
}
