import { ensureColumn, safeCreateIndex, schemaPool } from '@/lib/schema/mysql-utils';

let initialized = false;

export async function ensureCalendarSchema() {
  if (initialized) return;

  const pool = schemaPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id CHAR(36) NOT NULL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      calendar ENUM('meeting','deadline','reminder','travel') NOT NULL DEFAULT 'meeting',
      description TEXT NULL,
      location VARCHAR(255) NULL,
      start_at DATETIME(3) NOT NULL,
      end_at DATETIME(3) NULL,
      all_day TINYINT(1) NOT NULL DEFAULT 1,
      metadata_json JSON NULL,
      created_by CHAR(36) NULL,
      updated_by CHAR(36) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await ensureColumn('calendar_events', 'location', 'VARCHAR(255) NULL');
  await ensureColumn('calendar_events', 'metadata_json', 'JSON NULL');
  await ensureColumn('calendar_events', 'all_day', 'TINYINT(1) NOT NULL DEFAULT 1');

  await safeCreateIndex('CREATE INDEX idx_calendar_events_calendar ON calendar_events(calendar)');
  await safeCreateIndex('CREATE INDEX idx_calendar_events_start ON calendar_events(start_at)');
  await safeCreateIndex('CREATE INDEX idx_calendar_events_end ON calendar_events(end_at)');

  initialized = true;
}
