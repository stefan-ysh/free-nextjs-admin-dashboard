import './load-env';

import path from 'node:path';
import process from 'node:process';

import xlsx from 'xlsx';

import { createRecord } from '@/lib/db/finance';
import { mysqlPool } from '@/lib/mysql';
import { ensureFinanceSchema } from '@/lib/schema/finance';
import { matchCategoryLabel } from '@/constants/finance-categories';
import {
  FinanceRecordInput,
  InvoiceStatus,
  InvoiceType,
  PaymentType,
  TransactionType,
} from '@/types/finance';

type SkippedRecord = {
  rowNumber: number;
  name?: string;
  date?: string;
  contractAmount?: number;
  reason: string;
};

const DEFAULT_FILE_NAME = '个人记账管理 (3).xlsx';
const SHEET_NAME = '个人账单记录';

const paymentTypeMap: Record<string, PaymentType> = {
  定金: PaymentType.DEPOSIT,
  全款: PaymentType.FULL_PAYMENT,
  分期: PaymentType.INSTALLMENT,
  尾款: PaymentType.BALANCE,
  其他: PaymentType.OTHER,
};

function cleanString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const result = String(value).trim();
  return result.length ? result : undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const numeric = String(value)
    .replace(/[¥￥,\s]/g, '')
    .replace(/^-?\./, '0.');
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDate(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const dateCode = xlsx.SSF.parse_date_code(value);
    if (dateCode) {
      const date = new Date(Date.UTC(dateCode.y, (dateCode.m ?? 1) - 1, dateCode.d ?? 1));
      return date.toISOString().slice(0, 10);
    }
  }

  const text = String(value)
    .trim()
    .replace(/[年\.]/g, '-')
    .replace(/[月]/g, '-')
    .replace(/[日]/g, '');
  if (!text) return undefined;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function mapTransactionType(value: unknown): TransactionType {
  return String(value).includes('收') ? TransactionType.INCOME : TransactionType.EXPENSE;
}

function mapPaymentType(value: unknown): PaymentType {
  const key = cleanString(value);
  if (!key) return PaymentType.FULL_PAYMENT;
  return paymentTypeMap[key] ?? PaymentType.FULL_PAYMENT;
}

function mapInvoiceType(value: unknown): InvoiceType {
  const text = cleanString(value);
  if (!text || text.includes('无需')) return InvoiceType.NONE;
  if (text.includes('专')) return InvoiceType.SPECIAL;
  return InvoiceType.GENERAL;
}

function mapInvoiceStatus(value: unknown): InvoiceStatus {
  const text = cleanString(value);
  if (!text || text.includes('无需')) return InvoiceStatus.NOT_REQUIRED;
  if (text.includes('已')) return InvoiceStatus.ISSUED;
  return InvoiceStatus.PENDING;
}

function parseAttachments(value: unknown): string[] | undefined {
  const text = cleanString(value);
  if (!text) return undefined;
  const parts = text
    .split(/[，,；;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

async function recordExists(params: {
  name: string;
  date: string;
  contractAmount: number;
  fee: number;
  type: TransactionType;
  category: string;
}) {
  const pool = mysqlPool();
  const [rows] = await pool.query<Array<{ id: string }>>(
    `SELECT id FROM finance_records
     WHERE name = ?
       AND date_value = ?
       AND contract_amount = ?
       AND fee = ?
       AND type = ?
       AND category = ?
     LIMIT 1`,
    [
      params.name,
      params.date,
      params.contractAmount,
      params.fee,
      params.type,
      params.category,
    ]
  );
  return Boolean(rows[0]?.id);
}

async function main() {
  const excelPath = path.resolve(process.cwd(), process.argv[2] ?? DEFAULT_FILE_NAME);
  const workbook = xlsx.readFile(excelPath);
  const worksheet = workbook.Sheets[SHEET_NAME];
  if (!worksheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found in ${excelPath}`);
  }

  await ensureFinanceSchema();
  const pool = mysqlPool();
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

  let created = 0;
  let skipped = 0;
  const skippedRecords: SkippedRecord[] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2; // assume sheet header occupies first row
    const name = cleanString(row['明细']);
    const category = cleanString(row['分类']);
    const date = parseDate(row['日期']);
    const contractAmount = parseNumber(row['合同金额']);
    if (!name || !category || !date || contractAmount == null) {
      skipped += 1;
      skippedRecords.push({ rowNumber, name, date, contractAmount, reason: '缺少关键字段' });
      continue;
    }

    const fee = parseNumber(row['手续费']) ?? 0;
    const quantity = parseNumber(row['数量']) ?? 1;
    const paymentChannel = cleanString(row['支付方式']);
    const payer = cleanString(row['代付人']);
    const transactionNo = cleanString(row['流水']);
    const remarks = cleanString(row['备注']);
    const monthTag = cleanString(row['月份']);

    const invoiceType = mapInvoiceType(row['发票类型']);
    const invoiceStatus = mapInvoiceStatus(row['开票状态']);
    const attachments = parseAttachments(row['发票']);

    const invoice =
      invoiceType === InvoiceType.NONE && invoiceStatus === InvoiceStatus.NOT_REQUIRED && !attachments
        ? undefined
        : {
            type: invoiceType,
            status: invoiceStatus,
            attachments,
          };

    const type = mapTransactionType(row['收支类型']);
    const normalizedCategory = matchCategoryLabel(type, category) ?? category;
    if (
      await recordExists({
        name,
        date,
        contractAmount,
        fee,
        type,
        category: normalizedCategory,
      })
    ) {
      skipped += 1;
      skippedRecords.push({ rowNumber, name, date, contractAmount, reason: '记录已存在' });
      continue;
    }

    const payload: FinanceRecordInput = {
      name,
      category: normalizedCategory,
      date,
      contractAmount,
      fee,
      type,
      status: 'cleared',
      paymentType: mapPaymentType(row['款项类型']),
      quantity,
      paymentChannel,
      payer,
      transactionNo,
      invoice,
      description: remarks,
      tags: monthTag ? [monthTag] : undefined,
      sourceType: 'import',
    };

    await createRecord(payload);
    created += 1;
  }

  await pool.end();
  console.log(`导入完成：新增 ${created} 条，跳过 ${skipped} 条。`);
  if (skippedRecords.length) {
    console.log('\n以下记录被跳过，请手动处理：');
    skippedRecords.forEach((record, idx) => {
      const amountText =
        typeof record.contractAmount === 'number' ? record.contractAmount.toFixed(2) : '无合同金额';
      console.log(
        `${idx + 1}. 行 ${record.rowNumber} - ${record.name ?? '无名称'} | ${record.date ?? '无日期'} | ${amountText} (${record.reason})`
      );
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
