import { randomUUID } from 'crypto';

import { mysqlQuery } from '@/lib/mysql';
import { ensureAuthSchema } from './schema';

export type AuthAuditAction =
  | 'password.reset'
  | 'password.change'
  | 'roles.update';

export async function logAuthAudit(params: {
  actorId: string;
  targetId?: string | null;
  action: AuthAuditAction;
  metadata?: Record<string, unknown>;
}) {
  await ensureAuthSchema();
  const id = randomUUID();
  const metadata = params.metadata ?? {};
  await mysqlQuery`
    INSERT INTO auth_audit_logs (id, actor_id, target_id, action, metadata_json)
    VALUES (${id}, ${params.actorId}, ${params.targetId ?? null}, ${params.action}, ${JSON.stringify(metadata)})
  `;
}
