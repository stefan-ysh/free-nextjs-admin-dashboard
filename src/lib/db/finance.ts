import type { VercelKV } from '@vercel/kv';
import {
  FinanceRecord,
  TransactionType,
  FinanceStats,
  CategoryStat,
} from '@/types/finance';
import { mockRecords } from './mockData';

/**
 * 财务记录数据访问层
 * 使用 Vercel KV (Redis) 存储数据
 * 开发环境:如果未配置KV环境变量或KV连接失败,自动使用Mock数据
 */

// 检查是否应该使用Mock模式
const shouldUseMock = () => {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return true;
  }
  if (process.env.KV_REST_API_URL.trim() === '' || process.env.KV_REST_API_TOKEN.trim() === '') {
    return true;
  }
  return false;
};

const USE_MOCK = shouldUseMock();

// 懒加载KV连接 - 只在非Mock模式下才导入和初始化
let kvInstance: VercelKV | null = null;
const getKV = async (): Promise<VercelKV> => {
  if (USE_MOCK) {
    throw new Error('Mock模式下不应调用KV');
  }

  if (!kvInstance) {
    try {
      const { kv } = await import('@vercel/kv');
      kvInstance = kv;
      console.log('✅ KV连接初始化成功');
    } catch (error) {
      console.error('❌ KV连接初始化失败:', error);
      throw error;
    }
  }

  return kvInstance;
};

if (USE_MOCK) {
  console.log('⚠️  财务模块运行在Mock模式 - 未检测到有效的Vercel KV配置');
  console.log('💡 数据存储在内存中,服务器重启后会丢失');
  console.log('📚 生产部署请参考: docs/VERCEL_KV_SETUP.md');
} else {
  console.log('🔄 KV模式已启用');
  console.log(`📍 KV URL: ${process.env.KV_REST_API_URL}`);
}

// 内存存储(Mock模式)
const mockStorage: FinanceRecord[] = [...mockRecords];
let mockCounter = mockRecords.length;

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
  if (USE_MOCK) {
    mockCounter++;
    return `mock-${Date.now()}-${mockCounter}`;
  }
  const kv = await getKV();
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

  if (USE_MOCK) {
    mockStorage.push(newRecord);
    return newRecord;
  }

  try {
    const kv = await getKV();
    
    // 保存记录
  await kv.set(KEYS.RECORD(id), newRecord);
    
    // 添加到排序列表 (按日期排序)
    const timestamp = new Date(record.date).getTime();
    await kv.zadd(KEYS.RECORDS_LIST, { score: timestamp, member: id });

    // 清除统计缓存
    const month = record.date.substring(0, 7); // YYYY-MM
    await kv.del(KEYS.STATS_CACHE(month));

    return newRecord;
  } catch (error) {
    console.error('KV创建记录失败,fallback到Mock模式:', error);
    mockStorage.push(newRecord);
    return newRecord;
  }
}

/**
 * 获取单条记录
 */
export async function getRecord(id: string): Promise<FinanceRecord | null> {
  if (USE_MOCK) {
    return mockStorage.find(r => r.id === id) || null;
  }
  
  try {
    const kv = await getKV();
    const data = await kv.get<FinanceRecord | string | null>(KEYS.RECORD(id));

    if (!data) return null;

    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as FinanceRecord;
      } catch (parseError) {
        console.error('KV记录解析失败, 返回null:', parseError);
        return null;
      }
    }

    return data;
  } catch (error) {
    console.error('KV获取记录失败,fallback到Mock模式:', error);
    return mockStorage.find(r => r.id === id) || null;
  }
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

  if (USE_MOCK) {
    const index = mockStorage.findIndex(r => r.id === id);
    if (index !== -1) {
      mockStorage[index] = updated;
    }
    return updated;
  }

  const kv = await getKV();
  await kv.set(KEYS.RECORD(id), updated);

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

  if (USE_MOCK) {
    const index = mockStorage.findIndex(r => r.id === id);
    if (index !== -1) {
      mockStorage.splice(index, 1);
      return true;
    }
    return false;
  }

  const kv = await getKV();
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
  const rawStart = startDate ? new Date(startDate).getTime() : 0;
  const rawEnd = endDate ? new Date(endDate).getTime() : Date.now();
  const minScore = Math.min(rawStart, rawEnd);
  const maxScore = Math.max(rawStart, rawEnd);
  
  if (USE_MOCK) {
    return mockStorage
      .filter(r => {
        const time = new Date(r.date).getTime();
        return time >= minScore && time <= maxScore;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(offset, offset + limit);
  }

  try {
    const kv = await getKV();
    // 从排序集合获取ID列表 (降序，最新的在前)
    // Upstash 在 rev 模式下要求先传入最大分数再传最小分数
    const ids = await kv.zrange(
      KEYS.RECORDS_LIST,
      maxScore,
      minScore,
      {
        byScore: true,
        rev: true,
        offset,
        count: limit,
      }
    );

    if (!ids || ids.length === 0) return [];

    const records: FinanceRecord[] = [];
    for (const id of ids) {
      const record = await getRecord(id as string);
      if (record) records.push(record);
    }

    return records;
  } catch (error) {
    console.error('KV获取记录列表失败,fallback到Mock模式:', error);
    return mockStorage
      .filter(r => {
        const time = new Date(r.date).getTime();
        return time >= minScore && time <= maxScore;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(offset, offset + limit);
  }
}

/**
 * 获取记录总数
 */
export async function getRecordsCount(
  startDate?: string,
  endDate?: string
): Promise<number> {
  const rawStart = startDate ? new Date(startDate).getTime() : 0;
  const rawEnd = endDate ? new Date(endDate).getTime() : Date.now();
  const minScore = Math.min(rawStart, rawEnd);
  const maxScore = Math.max(rawStart, rawEnd);
  
  if (USE_MOCK) {
    return mockStorage.filter(r => {
      const time = new Date(r.date).getTime();
      return time >= minScore && time <= maxScore;
    }).length;
  }

  try {
    const kv = await getKV();
    const count = await kv.zcount(KEYS.RECORDS_LIST, minScore, maxScore);
    return count || 0;
  } catch (error) {
    console.error('KV获取记录数失败,fallback到Mock模式:', error);
    return mockStorage.filter(r => {
      const time = new Date(r.date).getTime();
      return time >= minScore && time <= maxScore;
    }).length;
  }
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

  if (USE_MOCK) {
    return defaultCategories;
  }

  try {
    const key = KEYS.CATEGORIES(type);
    const kv = await getKV();
    const categoriesData = await kv.get<string[] | string | null>(key);

    if (categoriesData) {
      if (Array.isArray(categoriesData)) {
        return categoriesData;
      }

      try {
        const parsed = JSON.parse(categoriesData) as string[];
        if (Array.isArray(parsed)) return parsed;
      } catch (parseError) {
        console.error('KV分类解析失败,改用默认分类:', parseError);
      }
    }

    await kv.set(key, defaultCategories);
    return defaultCategories;
  } catch (error) {
    console.error('KV操作失败,使用默认分类:', error);
    return defaultCategories;
  }
}

/**
 * 添加自定义分类
 */
export async function addCategory(type: TransactionType, category: string): Promise<void> {
  if (USE_MOCK) {
    // Mock模式下不持久化自定义分类
    return;
  }
  
  const categories = await getCategories(type);
  if (!categories.includes(category)) {
    categories.push(category);
    const kv = await getKV();
    await kv.set(KEYS.CATEGORIES(type), categories);
  }
}
