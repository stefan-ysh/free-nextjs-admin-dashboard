import { randomBytes, randomUUID } from 'crypto';

import { sql } from '@/lib/postgres';
import { ensureAuthSchema } from './schema';
import { DeviceType } from './device';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 2; // 2 days

export type SessionRecord = {
  id: string;
  user_id: string;
  session_token: string;
  device_type: DeviceType;
  user_agent_hash: string;
  user_agent: string | null;
  remember_me: boolean;
  created_at: string;
  expires_at: string;
  last_active: string;
};

export async function createSession(options: {
  userId: string;
  deviceType: DeviceType;
  userAgentHash: string;
  userAgent: string;
  rememberMe: boolean;
}): Promise<{ token: string; expiresAt: Date }> {
  await ensureAuthSchema();

  const id = randomUUID();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await sql`
    INSERT INTO auth_sessions (id, user_id, session_token, device_type, user_agent_hash, user_agent, remember_me, expires_at)
    VALUES (${id}, ${options.userId}, ${token}, ${options.deviceType}, ${options.userAgentHash}, ${options.userAgent}, ${options.rememberMe}, ${expiresAt.toISOString()})
  `;

  return { token, expiresAt };
}

export async function invalidateSession(token: string): Promise<void> {
  await ensureAuthSchema();
  await sql`DELETE FROM auth_sessions WHERE session_token = ${token}`;
}

export async function invalidateSessionsForDeviceType(userId: string, deviceType: DeviceType): Promise<void> {
  await ensureAuthSchema();
  await sql`DELETE FROM auth_sessions WHERE user_id = ${userId} AND device_type = ${deviceType}`;
}

export async function findActiveSession(token: string): Promise<SessionRecord | null> {
  await ensureAuthSchema();
  const result = await sql<SessionRecord>`
    SELECT * FROM auth_sessions
    WHERE session_token = ${token}
      AND expires_at > NOW()
    LIMIT 1
  `;

  const record = result.rows[0];
  if (!record) return null;

  await sql`
    UPDATE auth_sessions
    SET last_active = NOW()
    WHERE id = ${record.id}
  `;

  return { ...record, last_active: new Date().toISOString() };
}

export async function revokeExpiredSessions(): Promise<void> {
  await ensureAuthSchema();
  await sql`DELETE FROM auth_sessions WHERE expires_at <= NOW()`;
}

export async function listSessionsForUser(userId: string): Promise<SessionRecord[]> {
  await ensureAuthSchema();
  const result = await sql<SessionRecord>`
    SELECT * FROM auth_sessions
    WHERE user_id = ${userId}
    ORDER BY remember_me DESC, last_active DESC
  `;
  return result.rows;
}

export async function revokeSessionById(sessionId: string, userId: string): Promise<void> {
  await ensureAuthSchema();
  await sql`
    DELETE FROM auth_sessions WHERE id = ${sessionId} AND user_id = ${userId}
  `;
}
