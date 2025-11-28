import './load-env';

import { mysqlPool } from '@/lib/mysql';
import { FINANCE_CATEGORY_OPTIONS, matchCategoryLabel } from '@/constants/finance-categories';
import { TransactionType } from '@/types/finance';
import { RowDataPacket } from 'mysql2';

// 扩展 RowDataPacket 以包含我们需要查询的字段
interface FinanceRecordRow extends RowDataPacket {
  id: string;
  category: string;
  type: TransactionType;
}

async function migrateCategories() {
  const pool = mysqlPool();

  console.log('🚀 开始执行财务分类迁移 (MySQL版)...\n');

  try {
    // 1. 获取所有财务记录
    // 我们只需要 id, category, type 字段
    const [rows] = await pool.query<FinanceRecordRow[]>(
      'SELECT id, category, type FROM finance_records'
    );

    console.log(`📊 扫描到 ${rows.length} 条记录`);

    let migratedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;
    const changes = new Map<string, { from: string; to: string; count: number }>();

    // 2. 遍历并检查是否需要更新
    for (const record of rows) {
      // 使用现有的 matchCategoryLabel 逻辑，它已经包含了 aliases 映射
      // 注意：matchCategoryLabel 会返回标准化的 label，如果找不到则返回 undefined
      // 如果返回 undefined，说明这个 category 可能已经是标准名称，或者是不在列表中的未知名称
      // 我们需要反向检查：如果当前 category 已经在标准列表中，就不需要动

      const currentCategory = record.category;
      const type = record.type as TransactionType;

      // 检查当前分类是否已经是标准分类
      const isStandard = FINANCE_CATEGORY_OPTIONS.some(
        opt => opt.label === currentCategory && opt.type === type
      );

      if (isStandard) {
        unchangedCount++;
        continue;
      }

      // 尝试匹配新分类
      const newCategory = matchCategoryLabel(type, currentCategory);

      if (newCategory && newCategory !== currentCategory) {
        try {
          // 执行更新
          await pool.query(
            'UPDATE finance_records SET category = ? WHERE id = ?',
            [newCategory, record.id]
          );

          // 记录变更统计
          const key = `${currentCategory} -> ${newCategory}`;
          const stat = changes.get(key) || { from: currentCategory, to: newCategory, count: 0 };
          stat.count++;
          changes.set(key, stat);

          migratedCount++;
          // console.log(`✓ 更新: ${currentCategory} -> ${newCategory}`);
        } catch (err) {
          console.error(`✗ 更新失败 ID ${record.id}:`, err);
          errorCount++;
        }
      } else {
        // 无法匹配到新分类，保持原样
        unchangedCount++;
      }
    }

    // 3. 输出总结
    console.log('\n' + '='.repeat(50));
    console.log('📈 迁移总结');
    console.log('='.repeat(50));
    console.log(`总记录数: ${rows.length}`);
    console.log(`✓ 成功迁移: ${migratedCount}`);
    console.log(`- 保持不变: ${unchangedCount}`);
    console.log(`✗ 更新失败: ${errorCount}`);
    console.log('='.repeat(50));

    if (changes.size > 0) {
      console.log('\n📊 变更详情:');
      const sortedChanges = Array.from(changes.values()).sort((a, b) => b.count - a.count);
      for (const change of sortedChanges) {
        console.log(`  ${change.count.toString().padStart(4)} 条: ${change.from} -> ${change.to}`);
      }
    }

    // 4. 检查是否有未标准化的残留分类
    console.log('\n🔍 检查残留的非标准分类...');
    const [remainingRows] = await pool.query<FinanceRecordRow[]>(
      'SELECT category, type, COUNT(*) as count FROM finance_records GROUP BY category, type ORDER BY count DESC'
    );

    const nonStandard = remainingRows.filter(row => {
      return !FINANCE_CATEGORY_OPTIONS.some(opt => opt.label === row.category && opt.type === row.type);
    });

    if (nonStandard.length > 0) {
      console.log('⚠️  以下分类未在标准列表中定义 (可能需要手动处理):');
      nonStandard.forEach(row => {
        // @ts-ignore
        console.log(`  ${row.count} 条: [${row.type}] ${row.category}`);
      });
    } else {
      console.log('✨ 所有记录均已符合标准分类！');
    }

  } catch (error) {
    console.error('❌ 脚本执行出错:', error);
  } finally {
    await pool.end();
  }
}

migrateCategories().catch(console.error);
