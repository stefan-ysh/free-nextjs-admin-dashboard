#!/usr/bin/env node

import path from 'node:path';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const cwd = process.cwd();
dotenv.config({ path: path.join(cwd, '.env.local') });
dotenv.config({ path: path.join(cwd, '.env') });

function resolvePoolOptions() {
  const connectionLimit = Number(process.env.MYSQL_POOL_SIZE ?? '10');
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;

  if (url && url.trim()) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || '3306'),
      user: decodeURIComponent(parsed.username || 'root'),
      password: decodeURIComponent(parsed.password || ''),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '') || 'tailadmin_local'),
      waitForConnections: true,
      connectionLimit,
      decimalNumbers: true,
      timezone: 'Z'
    };
  }

  const host = process.env.MYSQL_HOST?.trim() || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT ?? '3306');
  const user = process.env.MYSQL_USER?.trim() || 'root';
  const password = process.env.MYSQL_PASSWORD ?? '';
  const database = process.env.MYSQL_DATABASE?.trim() || 'tailadmin_local';

  return {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit,
    decimalNumbers: true,
    timezone: 'Z'
  };
}

const pool = mysql.createPool(resolvePoolOptions());

async function safeCreateIndex(sql) {
  try {
    await pool.query(sql);
  } catch (error) {
    if (error?.code !== 'ER_DUP_KEYNAME') {
      throw error;
    }
  }
}

async function ensureDepartmentSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hr_departments (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      code VARCHAR(60),
      parent_id CHAR(36),
      description TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_hr_department_parent FOREIGN KEY (parent_id) REFERENCES hr_departments(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await safeCreateIndex('CREATE UNIQUE INDEX hr_departments_code_idx ON hr_departments(code)');
  await safeCreateIndex('CREATE INDEX hr_departments_parent_idx ON hr_departments(parent_id)');
  await safeCreateIndex('CREATE INDEX hr_departments_sort_order_idx ON hr_departments(sort_order)');
}

const departmentSeeds = [
  { name: '董事会', code: 'BOARD', sortOrder: 10, description: '公司最高决策机构，负责重大方向与监督' },
  { name: '总裁办', code: 'EXEC', parentCode: 'BOARD', sortOrder: 20, description: '战略规划、经营管理与对外事务统筹' },
  { name: '人力资源部', code: 'HR', parentCode: 'EXEC', sortOrder: 30, description: '招聘、培训、绩效与组织发展' },
  { name: '行政部', code: 'ADMIN', parentCode: 'EXEC', sortOrder: 35, description: '行政支持、会务与内部保障' },
  { name: '财务部', code: 'FIN', parentCode: 'EXEC', sortOrder: 40, description: '财务核算、预算、资金与税务管理' },
  { name: '法务部', code: 'LEGAL', parentCode: 'EXEC', sortOrder: 45, description: '合同审核、知识产权与合规治理' },
  { name: '市场部', code: 'MKT', parentCode: 'EXEC', sortOrder: 50, description: '品牌、公关、活动与市场洞察' },
  { name: '销售部', code: 'SALES', parentCode: 'EXEC', sortOrder: 60, description: '渠道拓展、客户管理与营收目标' },
  { name: '客户成功部', code: 'CS', parentCode: 'EXEC', sortOrder: 70, description: '客户交付、续约与满意度管理' },
  { name: '运营管理部', code: 'OPS', parentCode: 'EXEC', sortOrder: 80, description: '流程优化、数据分析与业务协同' },
  { name: '采购与供应链部', code: 'PROC', parentCode: 'FIN', sortOrder: 90, description: '供应商管理、采购策略与成本控制' },
  { name: '研发中心', code: 'ENG', parentCode: 'EXEC', sortOrder: 100, description: '产品研发、技术规划与交付质量' },
  { name: '产品管理部', code: 'PM', parentCode: 'ENG', sortOrder: 110, description: '产品规划、路线图与需求管理' },
  { name: '工程开发部', code: 'DEV', parentCode: 'ENG', sortOrder: 120, description: '软件/硬件开发与架构实现' },
  { name: '测试质量部', code: 'QA', parentCode: 'ENG', sortOrder: 130, description: '测试、质量保障与发布管理' },
  { name: 'IT运维部', code: 'ITOPS', parentCode: 'ENG', sortOrder: 140, description: '基础设施、网络与内部系统运维' }
];

function normalizeCode(code) {
  if (!code) return null;
  const trimmed = code.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

async function buildCodeMap() {
  const [rows] = await pool.query('SELECT id, code FROM hr_departments WHERE code IS NOT NULL');
  const map = new Map();
  rows.forEach((row) => {
    if (row.code) {
      map.set(row.code.toUpperCase(), row.id);
    }
  });
  return map;
}

async function resolveParentId(parentCode, codeMap) {
  if (!parentCode) return null;
  const normalized = normalizeCode(parentCode);
  if (!normalized) return null;
  if (codeMap.has(normalized)) {
    return codeMap.get(normalized);
  }
  const [rows] = await pool.query('SELECT id FROM hr_departments WHERE code = ? LIMIT 1', [normalized]);
  const id = rows[0]?.id ?? null;
  if (id) {
    codeMap.set(normalized, id);
  }
  return id;
}

async function upsertDepartment(entry, codeMap, stats) {
  const code = normalizeCode(entry.code);
  const parentId = await resolveParentId(entry.parentCode, codeMap);
  const sortOrder = Number.isFinite(entry.sortOrder) ? Math.trunc(entry.sortOrder) : 0;
  const description = entry.description?.trim() || null;

  const [existing] = code
    ? await pool.query('SELECT id FROM hr_departments WHERE code = ? LIMIT 1', [code])
    : [[], []];

  if (existing.length > 0) {
    await pool.query(
      `UPDATE hr_departments
        SET name = ?, parent_id = ?, sort_order = ?, description = ?, updated_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?`,
      [entry.name, parentId, sortOrder, description, existing[0].id]
    );
    codeMap.set(code, existing[0].id);
    stats.updated += 1;
    return;
  }

  if (entry.parentCode && !parentId) {
    console.warn(`⚠️  未找到父级编码 ${entry.parentCode}，将作为顶级部门插入 ${entry.name}`);
  }

  const id = randomUUID();
  await pool.query(
    `INSERT INTO hr_departments (id, name, code, parent_id, description, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [id, entry.name, code, parentId, description, sortOrder]
  );
  if (code) {
    codeMap.set(code, id);
  }
  stats.inserted += 1;
}

async function seedDepartments() {
  const stats = { inserted: 0, updated: 0 };
  const codeMap = await buildCodeMap();
  for (const dept of departmentSeeds) {
    await upsertDepartment(dept, codeMap, stats);
  }
  return stats;
}

async function main() {
  let exitCode = 0;
  try {
    await ensureDepartmentSchema();
    const result = await seedDepartments();
    console.log('部门初始化完成');
    console.table([{ 插入: result.inserted, 更新: result.updated }]);
  } catch (error) {
    console.error('部门初始化失败:', error);
    exitCode = 1;
  } finally {
    await pool.end();
    process.exit(exitCode);
  }
}

main();
