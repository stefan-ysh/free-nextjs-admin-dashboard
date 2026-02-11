import { randomBytes, randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2';

import { mysqlPool, mysqlQuery } from '@/lib/mysql';
import { ensureAuthSchema } from './schema';
import { DeviceType } from './device';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 2; // 2 days

const pool = mysqlPool();

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

type RawSessionRow = RowDataPacket & Omit<SessionRecord, 'remember_me'> & {
  remember_me: boolean | number;
};

function mapSession(row: RawSessionRow | undefined): SessionRecord | null {
  if (!row) return null;
  return {
    ...row,
    remember_me: row.remember_me === true || row.remember_me === 1,
  };
}

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
  const expiresAtSql = expiresAt.toISOString().replace('T', ' ').replace('Z', '');

  await mysqlQuery`
    INSERT INTO auth_sessions (id, user_id, session_token, device_type, user_agent_hash, user_agent, remember_me, expires_at)
    VALUES (${id}, ${options.userId}, ${token}, ${options.deviceType}, ${options.userAgentHash}, ${options.userAgent}, ${options.rememberMe ? 1 : 0}, ${expiresAtSql})
  `;

  return { token, expiresAt };
}

export async function invalidateSession(token: string): Promise<void> {
  await ensureAuthSchema();
  await mysqlQuery`DELETE FROM auth_sessions WHERE session_token = ${token}`;
}

export async function invalidateSessionsForDeviceType(userId: string, deviceType: DeviceType): Promise<void> {
  await ensureAuthSchema();
  await mysqlQuery`DELETE FROM auth_sessions WHERE user_id = ${userId} AND device_type = ${deviceType}`;
}

export async function invalidateSessionsForUser(userId: string): Promise<void> {
  await ensureAuthSchema();
  await mysqlQuery`DELETE FROM auth_sessions WHERE user_id = ${userId}`;
}

export async function findActiveSession(token: string): Promise<SessionRecord | null> {
  await ensureAuthSchema();
  const [rows] = await pool.query<RawSessionRow[]>(
    `SELECT * FROM auth_sessions
      WHERE session_token = ?
        AND expires_at > NOW()
      LIMIT 1`,
    [token]
  );

  const record = mapSession(rows[0]);
  if (!record) return null;

  await mysqlQuery`
    UPDATE auth_sessions
    SET last_active = NOW()
    WHERE id = ${record.id}
  `;

  return { ...record, last_active: new Date().toISOString() };
}

export async function revokeExpiredSessions(): Promise<void> {
  await ensureAuthSchema();
  await mysqlQuery`DELETE FROM auth_sessions WHERE expires_at <= NOW()`;
}

export async function listSessionsForUser(userId: string): Promise<SessionRecord[]> {
  await ensureAuthSchema();
  const result = await mysqlQuery<RawSessionRow>`
    SELECT * FROM auth_sessions
    WHERE user_id = ${userId}
    ORDER BY remember_me DESC, last_active DESC
  `;
  return result.rows.map((row) => mapSession(row)!).filter(Boolean) as SessionRecord[];
}

export async function revokeSessionById(sessionId: string, userId: string): Promise<void> {
  await ensureAuthSchema();
  await mysqlQuery`
    DELETE FROM auth_sessions WHERE id = ${sessionId} AND user_id = ${userId}
  `;
}
