import { sql } from '@/lib/postgres';

let initialized = false;

/**
 * Ensures auth-related tables exist. Safe to call multiple times.
 */
export async function ensureAuthSchema() {
  if (initialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      first_name TEXT,
      last_name TEXT,
      display_name TEXT,
      job_title TEXT,
      phone TEXT,
      bio TEXT,
      country TEXT,
      city TEXT,
      postal_code TEXT,
      tax_id TEXT,
      avatar_url TEXT,
      social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
      password_updated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
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

  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS first_name TEXT`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS last_name TEXT`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS display_name TEXT`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS job_title TEXT`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS phone TEXT`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS bio TEXT`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS country TEXT`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS city TEXT`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS postal_code TEXT`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS tax_id TEXT`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ`;

  await sql`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT`;

  initialized = true;
}
