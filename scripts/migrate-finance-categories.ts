import './load-env';

import process from 'node:process';

import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { mysqlPool } from '@/lib/mysql';
import { ensureFinanceSchema } from '@/lib/schema/finance';
import { TransactionType } from '@/types/finance';
import { getDefaultCategoryLabels } from '@/constants/finance-categories';

const pool = mysqlPool();

type CategoryMapping = Record<string, string>;

const incomeMapping: CategoryMapping = {
  收入: '主营业务收入',
  销售收入: '主营业务收入',
  资金注入: '投资及财务收益',
  银行公户办理相关: '其他收入',
};

const expenseMapping: CategoryMapping = {
  装修费用: '办公费（含文具/耗材/印刷/小额场地维修）',
  办公用品: '办公费（含文具/耗材/印刷/小额场地维修）',
  办公费: '办公费（含文具/耗材/印刷/小额场地维修）',
  交通费: '交通费（本地公务出行/通勤补贴/共享出行）',
  餐费: '业务招待费（餐饮宴请/礼品馈赠/商务娱乐）',
  团建: '福利费（节日福利/体检/团建/特殊补贴）',
  发放工资: '薪酬外补贴（通讯/交通/餐补/住房补贴）',
  工资: '薪酬外补贴（通讯/交通/餐补/住房补贴）',
  设备购买: '办公设备维修费（电脑/打印机/家电维修）',
  银行公户办理相关: '财务费用（银行手续费/贷款利息/汇兑损益）',
  材料费: '原材料检验费（制造业原材料质检）',
  服务费: '咨询费（服务业律师/会计/顾问咨询）',
  报销: '差旅费（跨区域交通/住宿/餐饮/签证）',
  采购支出: '原材料检验费（制造业原材料质检）',
  其他支出: '税费与规费（印花税/行政规费/公益捐赠）',
};

function getMapping(type: TransactionType): CategoryMapping {
  return type === TransactionType.INCOME ? incomeMapping : expenseMapping;
}

async function remapFinanceRecords(type: TransactionType, mapping: CategoryMapping) {
  let updated = 0;
  for (const [legacy, modern] of Object.entries(mapping)) {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE finance_records SET category = ? WHERE type = ? AND category = ?',
      [modern, type, legacy]
    );
    updated += result.affectedRows ?? 0;
  }
  return updated;
}

async function purgeLegacyCategories(type: TransactionType, mapping: CategoryMapping) {
  let removed = 0;
  for (const legacy of Object.keys(mapping)) {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM finance_categories WHERE type = ? AND name = ?',
      [type, legacy]
    );
    removed += result.affectedRows ?? 0;
  }
  return removed;
}

async function ensureDefaultCategories(type: TransactionType) {
  const labels = getDefaultCategoryLabels(type);
  let inserted = 0;
  for (const label of labels) {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT IGNORE INTO finance_categories (type, name, is_default) VALUES (?, ?, 1)',
      [type, label]
    );
    inserted += result.affectedRows ?? 0;
    await pool.query<ResultSetHeader>(
      'UPDATE finance_categories SET is_default = 1 WHERE type = ? AND name = ?',
      [type, label]
    );
  }
  return inserted;
}

async function collectUnmappedCategories(type: TransactionType, mapping: CategoryMapping) {
  const allowList = new Set(getDefaultCategoryLabels(type));
  const mappedLegacy = new Set(Object.keys(mapping));
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT DISTINCT category FROM finance_records WHERE type = ? ORDER BY category ASC',
    [type]
  );
  return rows
    .map((row) => String(row.category))
    .filter((name) => name && !allowList.has(name) && !mappedLegacy.has(name));
}

async function migrateType(type: TransactionType) {
  const mapping = getMapping(type);
  const updatedRecords = await remapFinanceRecords(type, mapping);
  const removedCategories = await purgeLegacyCategories(type, mapping);
  const insertedCategories = await ensureDefaultCategories(type);
  const unmatched = await collectUnmappedCategories(type, mapping);

  return {
    type,
    updatedRecords,
    removedCategories,
    insertedCategories,
    unmatched,
  };
}

async function main() {
  await ensureFinanceSchema();
  const incomeResult = await migrateType(TransactionType.INCOME);
  const expenseResult = await migrateType(TransactionType.EXPENSE);

  console.table(
    [incomeResult, expenseResult].map((result) => ({
      类型: result.type,
      '更新记录数': result.updatedRecords,
      '删除旧分类数': result.removedCategories,
      '新增默认分类数': result.insertedCategories,
      '仍需人工处理': result.unmatched.length,
    }))
  );

  if (incomeResult.unmatched.length || expenseResult.unmatched.length) {
    console.log('\n以下分类未能自动映射，请手动确认：');
    if (incomeResult.unmatched.length) {
      console.log(`- 收入: ${incomeResult.unmatched.join(', ')}`);
    }
    if (expenseResult.unmatched.length) {
      console.log(`- 支出: ${expenseResult.unmatched.join(', ')}`);
    }
  }
}

main()
  .catch((error) => {
    console.error('财务分类迁移失败:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
