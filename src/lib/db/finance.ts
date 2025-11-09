import { kv } from '@vercel/kv';
import { 
  FinanceRecord, 
  TransactionType, 
  FinanceStats, 
  CategoryStat,
  PaymentType,
  InvoiceType,
  InvoiceStatus,
  MonthlyStat
} from '@/types/finance';

/**
 * 财务记录数据访问层
 * 使用 Vercel KV (Redis) 存储数据
 */

// Redis Key 前缀
const KEYS = {
  RECORD: (id: string) => `finance:records:${id}`,
  RECORDS_LIST: 'finance:records:list',
  RECORDS_BY_MONTH: (month: string) => `finance:records:month:${month}`,
  CATEGORIES: (type: TransactionType) => `finance:categories:${type}`,
  STATS_CACHE: (month: string) => `finance:stats:${month}`,
  COUNTER: 'finance:counter',
};

/**
 * 生成唯一ID
 */
async function generateId(): Promise<string> {
  const counter = await kv.incr(KEYS.COUNTER);
  return `${Date.now()}-${counter}`;
}

/**
 * 创建财务记录
 */
export async function createRecord(
  record: Omit<FinanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'totalAmount'>
): Promise<FinanceRecord> {
  const id = await generateId();
  const now = new Date().toISOString();
  
  // 自动计算总金额
  const totalAmount = record.contractAmount + record.fee;
  
  const newRecord: FinanceRecord = {
    ...record,
    id,
    totalAmount,
    createdAt: now,
    updatedAt: now,
  };

  // 保存记录
  await kv.set(KEYS.RECORD(id), JSON.stringify(newRecord));
  
  // 添加到排序列表 (按日期排序)
  const timestamp = new Date(record.date).getTime();
  await kv.zadd(KEYS.RECORDS_LIST, { score: timestamp, member: id });

  // 清除统计缓存
  const month = record.date.substring(0, 7); // YYYY-MM
  await kv.del(KEYS.STATS_CACHE(month));

  return newRecord;
}

/**
 * 获取单条记录
 */
export async function getRecord(id: string): Promise<FinanceRecord | null> {
  const data = await kv.get<string>(KEYS.RECORD(id));
  return data ? JSON.parse(data) : null;
}

/**
 * 更新记录
 */
export async function updateRecord(
  id: string,
  updates: Partial<Omit<FinanceRecord, 'id' | 'createdAt' | 'totalAmount'>>
): Promise<FinanceRecord | null> {
  const existing = await getRecord(id);
  if (!existing) return null;

  // 重新计算总金额(如果合同金额或手续费有更新)
  const contractAmount = updates.contractAmount ?? existing.contractAmount;
  const fee = updates.fee ?? existing.fee;
  const totalAmount = contractAmount + fee;

  const updated: FinanceRecord = {
    ...existing,
    ...updates,
    totalAmount,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(KEYS.RECORD(id), JSON.stringify(updated));

  // 如果日期改变，更新排序
  if (updates.date && updates.date !== existing.date) {
    await kv.zrem(KEYS.RECORDS_LIST, id);
    const timestamp = new Date(updates.date).getTime();
    await kv.zadd(KEYS.RECORDS_LIST, { score: timestamp, member: id });
  }

  // 清除相关统计缓存
  const months = new Set([
    existing.date.substring(0, 7),
    updated.date.substring(0, 7),
  ]);
  for (const month of months) {
    await kv.del(KEYS.STATS_CACHE(month));
  }

  return updated;
}

/**
 * 删除记录
 */
export async function deleteRecord(id: string): Promise<boolean> {
  const record = await getRecord(id);
  if (!record) return false;

  await kv.del(KEYS.RECORD(id));
  await kv.zrem(KEYS.RECORDS_LIST, id);

  // 清除统计缓存
  const month = record.date.substring(0, 7);
  await kv.del(KEYS.STATS_CACHE(month));

  return true;
}

/**
 * 获取记录列表
 */
export async function getRecords(
  startDate?: string,
  endDate?: string,
  limit = 50,
  offset = 0
): Promise<FinanceRecord[]> {
  const start = startDate ? new Date(startDate).getTime() : 0;
  const end = endDate ? new Date(endDate).getTime() : Date.now();

  // 从排序集合获取ID列表 (降序，最新的在前)
  const ids = await kv.zrange(
    KEYS.RECORDS_LIST,
    start,
    end,
    { 
      byScore: true,
      rev: true,
      offset,
      count: limit,
    }
  );

  if (!ids || ids.length === 0) return [];

  // 批量获取记录
  const records: FinanceRecord[] = [];
  for (const id of ids) {
    const record = await getRecord(id as string);
    if (record) records.push(record);
  }

  return records;
}

/**
 * 获取记录总数
 */
export async function getRecordsCount(
  startDate?: string,
  endDate?: string
): Promise<number> {
  const start = startDate ? new Date(startDate).getTime() : 0;
  const end = endDate ? new Date(endDate).getTime() : Date.now();

  const count = await kv.zcount(KEYS.RECORDS_LIST, start, end);
  return count || 0;
}

/**
 * 获取财务统计
 */
export async function getStats(
  startDate?: string,
  endDate?: string
): Promise<FinanceStats> {
  const records = await getRecords(startDate, endDate, 10000);

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryMap = new Map<string, { amount: number; count: number; type: TransactionType }>();

  for (const record of records) {
    const amount = record.totalAmount; // 使用总金额统计
    
    if (record.type === TransactionType.INCOME) {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }

    const key = `${record.type}:${record.category}`;
    const existing = categoryMap.get(key) || { amount: 0, count: 0, type: record.type };
    categoryMap.set(key, {
      amount: existing.amount + amount,
      count: existing.count + 1,
      type: record.type,
    });
  }

  // 计算分类统计
  const categoryStats: CategoryStat[] = [];
  for (const [key, value] of categoryMap.entries()) {
    const [, category] = key.split(':');
    const total = value.type === TransactionType.INCOME ? totalIncome : totalExpense;
    categoryStats.push({
      category,
      amount: value.amount,
      count: value.count,
      percentage: total > 0 ? (value.amount / total) * 100 : 0,
    });
  }

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    recordCount: records.length,
    categoryStats: categoryStats.sort((a, b) => b.amount - a.amount),
  };
}

/**
 * 获取默认分类
 */
export async function getCategories(type: TransactionType): Promise<string[]> {
  const key = KEYS.CATEGORIES(type);
  const categories = await kv.get<string[]>(key);
  
  if (categories) return categories;

  // 默认分类 - 根据实际业务场景
  const defaultCategories = type === TransactionType.INCOME
    ? ['收入', '资金注入', '银行公户办理相关', '其他收入']
    : [
        '装修费用',
        '交通费', 
        '餐费',
        '团建',
        '发放工资',
        '设备购买',
        '银行公户办理相关',
        '材料费',
        '服务费',
        '报销',
        '办公用品',
        '其他支出'
      ];

  await kv.set(key, defaultCategories);
  return defaultCategories;
}

/**
 * 添加自定义分类
 */
export async function addCategory(type: TransactionType, category: string): Promise<void> {
  const categories = await getCategories(type);
  if (!categories.includes(category)) {
    categories.push(category);
    await kv.set(KEYS.CATEGORIES(type), categories);
  }
}
