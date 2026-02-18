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

async function main() {
  const pool = mysql.createPool({
    ...resolveMysqlConfig(),
    waitForConnections: true,
    connectionLimit: 5,
    decimalNumbers: true,
    timezone: 'Z',
  });

  try {
    const [pendingNoApprover] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, purchase_number, item_name
       FROM purchases
       WHERE is_deleted = 0
         AND status = 'pending_approval'
         AND pending_approver_id IS NULL
       ORDER BY updated_at DESC
       LIMIT 200`
    );

    const [inboundOverflow] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT
         p.id,
         p.purchase_number,
         p.item_name,
         COALESCE(p.quantity, 0) AS purchase_quantity,
         COALESCE(p.inbound_quantity, 0) AS inbound_quantity
       FROM purchases p
       WHERE p.is_deleted = 0
         AND COALESCE(p.quantity, 0) > 0
         AND COALESCE(p.inbound_quantity, 0) > COALESCE(p.quantity, 0)
       ORDER BY p.updated_at DESC
       LIMIT 200`
    );

    const [duplicatePurchaseReimbursements] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT
         r.source_purchase_id,
         p.purchase_number,
         COUNT(*) AS reimbursement_count
       FROM reimbursements r
       INNER JOIN purchases p ON p.id = r.source_purchase_id
       WHERE r.is_deleted = 0
         AND r.source_type = 'purchase'
         AND r.source_purchase_id IS NOT NULL
       GROUP BY r.source_purchase_id, p.purchase_number
       HAVING COUNT(*) > 1
       ORDER BY reimbursement_count DESC
       LIMIT 200`
    );

    const [corporateTransferReimbursements] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT
         r.id,
         r.reimbursement_number,
         p.purchase_number,
         p.payment_method
       FROM reimbursements r
       INNER JOIN purchases p ON p.id = r.source_purchase_id
       WHERE r.is_deleted = 0
         AND r.source_type = 'purchase'
         AND p.payment_method = 'bank_transfer'
       ORDER BY r.updated_at DESC
       LIMIT 200`
    );

    console.log('=== Purchase Health Check ===');
    console.log(`pending_approval but no approver: ${pendingNoApprover.length}`);
    console.log(`inbound quantity overflow: ${inboundOverflow.length}`);
    console.log(`duplicate purchase reimbursements: ${duplicatePurchaseReimbursements.length}`);
    console.log(`purchase reimbursements on corporate transfer: ${corporateTransferReimbursements.length}`);

    if (pendingNoApprover.length > 0) {
      console.log('\n[Pending Without Approver]');
      pendingNoApprover.forEach((row) => {
        console.log(`- ${row.purchase_number} | ${row.item_name} | ${row.id}`);
      });
    }

    if (inboundOverflow.length > 0) {
      console.log('\n[Inbound Quantity Overflow]');
      inboundOverflow.forEach((row) => {
        console.log(`- ${row.purchase_number} | ${row.item_name} | inbound=${row.inbound_quantity}/${row.purchase_quantity}`);
      });
    }

    if (duplicatePurchaseReimbursements.length > 0) {
      console.log('\n[Duplicate Purchase Reimbursements]');
      duplicatePurchaseReimbursements.forEach((row) => {
        console.log(`- ${row.purchase_number} | source=${row.source_purchase_id} | count=${row.reimbursement_count}`);
      });
    }

    if (corporateTransferReimbursements.length > 0) {
      console.log('\n[Invalid Purchase Reimbursements (Corporate Transfer)]');
      corporateTransferReimbursements.forEach((row) => {
        console.log(`- ${row.reimbursement_number} | purchase=${row.purchase_number} | payment_method=${row.payment_method}`);
      });
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('purchase health check failed', error);
  process.exitCode = 1;
});
