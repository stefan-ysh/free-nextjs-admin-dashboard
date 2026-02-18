import path from 'node:path';
import process from 'node:process';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

function resolveMysqlConfig() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (url?.trim()) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || '3306'),
      user: decodeURIComponent(parsed.username || 'root'),
      password: decodeURIComponent(parsed.password || ''),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '') || 'admin_cosmorigin'),
    };
  }
  return {
    host: process.env.MYSQL_HOST?.trim() || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER?.trim() || 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE?.trim() || 'admin_cosmorigin',
  };
}

type RuleResult = {
  key: string;
  level: 'error' | 'warn';
  count: number;
  detail: string;
  sample?: string[];
};

async function queryCount(
  pool: mysql.Pool,
  sql: string,
  params: unknown[] = []
): Promise<number> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(sql, params);
  return Number(rows[0]?.total ?? 0);
}

async function querySamples(
  pool: mysql.Pool,
  sql: string,
  formatter: (row: mysql.RowDataPacket) => string
): Promise<string[]> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(sql);
  return rows.map(formatter);
}

async function main() {
  const pool = mysql.createPool({
    ...resolveMysqlConfig(),
    waitForConnections: true,
    connectionLimit: 5,
    decimalNumbers: true,
    timezone: 'Z',
  });

  const results: RuleResult[] = [];

  try {
    const pendingApprovalNoApprover = await queryCount(
      pool,
      `SELECT COUNT(*) AS total
         FROM purchases
        WHERE is_deleted = 0
          AND status = 'pending_approval'
          AND pending_approver_id IS NULL`
    );
    results.push({
      key: 'purchase_pending_approval_no_approver',
      level: 'error',
      count: pendingApprovalNoApprover,
      detail: '采购待审批记录缺少审批人',
      sample:
        pendingApprovalNoApprover > 0
          ? await querySamples(
              pool,
              `SELECT purchase_number, item_name
                 FROM purchases
                WHERE is_deleted = 0
                  AND status = 'pending_approval'
                  AND pending_approver_id IS NULL
                ORDER BY updated_at DESC
                LIMIT 5`,
              (row) => `${row.purchase_number} | ${row.item_name}`
            )
          : [],
    });

    const inboundOverflow = await queryCount(
      pool,
      `SELECT COUNT(*) AS total
         FROM purchases
        WHERE is_deleted = 0
          AND COALESCE(quantity, 0) > 0
          AND COALESCE(inbound_quantity, 0) > COALESCE(quantity, 0)`
    );
    results.push({
      key: 'purchase_inbound_overflow',
      level: 'error',
      count: inboundOverflow,
      detail: '采购入库数量超过采购数量',
    });

    const legacyPaidStatus = await queryCount(
      pool,
      `SELECT COUNT(*) AS total
         FROM purchases
        WHERE is_deleted = 0
          AND status = 'paid'`
    );
    results.push({
      key: 'purchase_legacy_paid_status',
      level: 'warn',
      count: legacyPaidStatus,
      detail: '存在旧状态 paid（当前采购流程应以待入库/入库完成为主）',
    });

    const reimbursePendingNoApprover = await queryCount(
      pool,
      `SELECT COUNT(*) AS total
         FROM reimbursements
        WHERE is_deleted = 0
          AND status = 'pending_approval'
          AND pending_approver_id IS NULL`
    );
    results.push({
      key: 'reimbursement_pending_no_approver',
      level: 'error',
      count: reimbursePendingNoApprover,
      detail: '报销待处理记录缺少财务处理人',
    });

    const reimbursePaidNoPaidAt = await queryCount(
      pool,
      `SELECT COUNT(*) AS total
         FROM reimbursements
        WHERE is_deleted = 0
          AND status = 'paid'
          AND paid_at IS NULL`
    );
    results.push({
      key: 'reimbursement_paid_no_timestamp',
      level: 'error',
      count: reimbursePaidNoPaidAt,
      detail: '报销已打款记录缺少打款时间',
    });

    const reimburseRejectedNoReason = await queryCount(
      pool,
      `SELECT COUNT(*) AS total
         FROM reimbursements
        WHERE is_deleted = 0
          AND status = 'rejected'
          AND (rejection_reason IS NULL OR TRIM(rejection_reason) = '')`
    );
    results.push({
      key: 'reimbursement_rejected_no_reason',
      level: 'warn',
      count: reimburseRejectedNoReason,
      detail: '报销驳回缺少驳回原因',
    });

    const duplicatePurchaseReimbursements = await queryCount(
      pool,
      `SELECT COUNT(*) AS total
         FROM (
           SELECT source_purchase_id
             FROM reimbursements
            WHERE is_deleted = 0
              AND source_type = 'purchase'
              AND source_purchase_id IS NOT NULL
            GROUP BY source_purchase_id
           HAVING COUNT(*) > 1
         ) t`
    );
    results.push({
      key: 'reimbursement_duplicate_purchase_link',
      level: 'error',
      count: duplicatePurchaseReimbursements,
      detail: '同一采购单被重复关联到多张报销单',
    });

    const corporateTransferLinked = await queryCount(
      pool,
      `SELECT COUNT(*) AS total
         FROM reimbursements r
         INNER JOIN purchases p ON p.id = r.source_purchase_id
        WHERE r.is_deleted = 0
          AND r.source_type = 'purchase'
          AND p.payment_method = 'corporate_transfer'`
    );
    results.push({
      key: 'reimbursement_linked_to_corporate_transfer',
      level: 'error',
      count: corporateTransferLinked,
      detail: '报销错误关联了对公转账采购单',
    });

    const pendingInboundForRejected = await queryCount(
      pool,
      `SELECT COUNT(*) AS total
         FROM purchases
        WHERE is_deleted = 0
          AND status = 'pending_inbound'
          AND (approved_at IS NULL OR approved_by IS NULL)`
    );
    results.push({
      key: 'purchase_pending_inbound_without_approval',
      level: 'error',
      count: pendingInboundForRejected,
      detail: '采购处于待入库但缺少审批通过信息',
    });

    console.log('=== Workflow Integrity Check ===');
    console.log(`Database: ${resolveMysqlConfig().database}`);
    console.log('');

    for (const item of results) {
      const icon = item.level === 'error' ? '[ERROR]' : '[WARN ]';
      console.log(`${icon} ${item.key}: ${item.count} (${item.detail})`);
      if (item.sample?.length) {
        item.sample.forEach((s) => console.log(`  - ${s}`));
      }
    }

    const errorCount = results
      .filter((item) => item.level === 'error')
      .reduce((sum, item) => sum + (item.count > 0 ? 1 : 0), 0);
    const warnCount = results
      .filter((item) => item.level === 'warn')
      .reduce((sum, item) => sum + (item.count > 0 ? 1 : 0), 0);

    console.log('');
    if (errorCount > 0) {
      console.log(`Result: FAIL (error rules hit: ${errorCount}, warn rules hit: ${warnCount})`);
      process.exitCode = 2;
      return;
    }
    if (warnCount > 0) {
      console.log(`Result: PASS_WITH_WARNINGS (warn rules hit: ${warnCount})`);
      return;
    }
    console.log('Result: PASS');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('workflow integrity check failed', error);
  process.exitCode = 1;
});
