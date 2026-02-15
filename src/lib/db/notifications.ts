import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { mysqlPool } from '@/lib/mysql';
import { ensureHrSchema } from '@/lib/hr/schema';
import { safeCreateIndex } from '@/lib/schema/mysql-utils';

let notificationSchemaReady = false;

type NotificationRow = RowDataPacket & {
  id: string;
  event_type: string;
  title: string;
  content: string;
  link_url: string | null;
  related_type: string | null;
  related_id: string | null;
  is_read: number;
  created_at: string;
  read_at: string | null;
};

type FinanceUserRow = RowDataPacket & {
  id: string;
};

type EmployeeEmailRow = RowDataPacket & {
  email: string | null;
};

async function ensureNotificationsSchema() {
  if (notificationSchemaReady) return;
  await ensureHrSchema();
  const pool = mysqlPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_notifications (
      id CHAR(36) NOT NULL PRIMARY KEY,
      recipient_id CHAR(36) NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      title VARCHAR(191) NOT NULL,
      content TEXT NOT NULL,
      link_url VARCHAR(500),
      related_type VARCHAR(64),
      related_id CHAR(36),
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      read_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_app_notifications_recipient
        FOREIGN KEY (recipient_id) REFERENCES hr_employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeCreateIndex(
    'CREATE INDEX idx_app_notifications_recipient_created ON app_notifications(recipient_id, created_at DESC)'
  );
  await safeCreateIndex('CREATE INDEX idx_app_notifications_related ON app_notifications(related_type, related_id)');
  notificationSchemaReady = true;
}

export async function createInAppNotifications(params: {
  recipientIds: string[];
  eventType: string;
  title: string;
  content: string;
  linkUrl?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
}) {
  await ensureNotificationsSchema();
  const recipientIds = Array.from(
    new Set(params.recipientIds.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))
  );
  if (recipientIds.length === 0) return 0;

  const pool = mysqlPool();
  const values = recipientIds.map((recipientId) => [
    randomUUID(),
    recipientId,
    params.eventType,
    params.title,
    params.content,
    params.linkUrl ?? null,
    params.relatedType ?? 'purchase',
    params.relatedId ?? null,
  ]);

  await pool.query(
    `INSERT INTO app_notifications
      (id, recipient_id, event_type, title, content, link_url, related_type, related_id)
     VALUES ?`,
    [values]
  );
  return values.length;
}

export async function listInAppNotificationsByRecipient(params: {
  recipientId: string;
  page: number;
  pageSize: number;
}) {
  await ensureNotificationsSchema();
  const page = Math.max(1, Math.floor(params.page || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize || 20)));
  const offset = (page - 1) * pageSize;
  const pool = mysqlPool();

  const [rows] = await pool.query<NotificationRow[]>(
    `SELECT id, event_type, title, content, link_url, related_type, related_id, is_read, created_at, read_at
     FROM app_notifications
     WHERE recipient_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [params.recipientId, pageSize, offset]
  );

  const [countRows] = await pool.query<Array<RowDataPacket & { total: number }>>(
    'SELECT COUNT(*) AS total FROM app_notifications WHERE recipient_id = ?',
    [params.recipientId]
  );
  const total = Number(countRows[0]?.total ?? 0);

  return {
    items: rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      title: row.title,
      content: row.content,
      linkUrl: row.link_url,
      relatedType: row.related_type,
      relatedId: row.related_id,
      isRead: Boolean(row.is_read),
      createdAt: row.created_at,
      readAt: row.read_at,
    })),
    total,
    page,
    pageSize,
  };
}

export async function listFinanceRecipientIds() {
  await ensureNotificationsSchema();
  const pool = mysqlPool();
  const [rows] = await pool.query<FinanceUserRow[]>(
    `SELECT id
     FROM hr_employees
     WHERE is_active = 1
       AND (
         primary_role IN ('finance','admin','super_admin')
         OR JSON_CONTAINS(roles, JSON_QUOTE('finance'), '$')
         OR JSON_CONTAINS(roles, JSON_QUOTE('admin'), '$')
         OR JSON_CONTAINS(roles, JSON_QUOTE('super_admin'), '$')
       )`
  );
  return rows.map((row) => row.id);
}

export async function listRecipientEmailsByIds(ids: string[]) {
  await ensureNotificationsSchema();
  const normalizedIds = Array.from(
    new Set(ids.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))
  );
  if (normalizedIds.length === 0) return [];

  const placeholders = normalizedIds.map(() => '?').join(',');
  const pool = mysqlPool();
  const [rows] = await pool.query<EmployeeEmailRow[]>(
    `SELECT email
     FROM hr_employees
     WHERE id IN (${placeholders})
       AND is_active = 1`,
    normalizedIds
  );
  return Array.from(
    new Set(rows.map((row) => row.email?.trim().toLowerCase()).filter((item): item is string => Boolean(item)))
  );
}

export async function markInAppNotificationsAsRead(params: {
  recipientId: string;
  ids?: string[];
}) {
  await ensureNotificationsSchema();
  const pool = mysqlPool();
  const ids = Array.from(
    new Set((params.ids ?? []).map((item) => item?.trim()).filter((item): item is string => Boolean(item)))
  );

  if (ids.length === 0) {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE app_notifications
       SET is_read = 1, read_at = NOW(3)
       WHERE recipient_id = ? AND is_read = 0`,
      [params.recipientId]
    );
    return Number(result.affectedRows ?? 0);
  }

  const placeholders = ids.map(() => '?').join(', ');
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE app_notifications
     SET is_read = 1, read_at = NOW(3)
     WHERE recipient_id = ? AND id IN (${placeholders}) AND is_read = 0`,
    [params.recipientId, ...ids]
  );
  return Number(result.affectedRows ?? 0);
}
