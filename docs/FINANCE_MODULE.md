# 财务管理系统 - 开发文档

## 项目概述

在原有 Next.js Admin Dashboard 基础上新增财务记录管理功能,用于公司业务财务管理。

## 技术栈

- **框架**: Next.js 15+ (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **图表**: ApexCharts
- **数据存储**: Vercel KV (Redis)
- **部署**: Vercel / Cloudflare Pages

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   └── finance/              # 财务 API 路由
│   │       ├── records/          # 记录 CRUD
│   │       ├── stats/            # 统计数据
│   │       └── categories/       # 分类管理
│   └── (admin)/
│       └── finance/              # 财务管理页面
│           └── page.tsx
├── components/
│   └── finance/                  # 财务相关组件
│       ├── FinanceForm.tsx       # 记录表单
│       ├── FinanceTable.tsx      # 记录列表
│       └── FinanceStatsCards.tsx # 统计卡片
├── lib/
│   └── db/
│       └── finance.ts            # 数据访问层
└── types/
    └── finance.ts                # 类型定义
```

## 核心功能

### 1. 财务记录管理

#### 数据模型

```typescript
interface FinanceRecord {
  id: string;                    // 唯一标识
  type: TransactionType;         // 收入/支出
  amount: number;                // 金额
  category: string;              // 分类
  description: string;           // 描述
  date: string;                  // 日期
  tags?: string[];               // 标签
  createdAt: string;             // 创建时间
  updatedAt: string;             // 更新时间
}
```

#### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/finance/records` | 获取记录列表 |
| POST | `/api/finance/records` | 创建记录 |
| GET | `/api/finance/records/[id]` | 获取单条记录 |
| PATCH | `/api/finance/records/[id]` | 更新记录 |
| DELETE | `/api/finance/records/[id]` | 删除记录 |
| GET | `/api/finance/stats` | 获取统计数据 |
| GET | `/api/finance/categories` | 获取分类列表 |
| POST | `/api/finance/categories` | 添加分类 |

### 2. 数据存储设计

使用 Redis (Vercel KV) 存储,Key 设计:

```
finance:records:{id}              # 单条记录 (String/JSON)
finance:records:list              # 记录ID列表 (Sorted Set, 按时间排序)
finance:categories:{type}         # 分类列表 (JSON Array)
finance:stats:monthly:{YYYY-MM}   # 月度统计缓存 (Hash)
finance:counter                   # ID 计数器 (String)
```

#### 为什么选择 Redis?

- ✅ **高性能**: 内存数据库,毫秒级响应
- ✅ **数据结构丰富**: Sorted Set 适合时间排序
- ✅ **免费额度充足**: Vercel KV 免费 256MB
- ✅ **部署简单**: 无需单独服务器
- ✅ **自动备份**: Vercel 提供持久化

### 3. 页面功能

#### 统计卡片
- 总收入
- 总支出
- 净收支 (余额)
- 记录数量

#### 记录表单
- 类型选择: 收入/支出
- 金额输入 (支持小数)
- 分类选择 (下拉菜单)
- 日期选择 (日期选择器)
- 备注描述 (多行文本)

#### 记录列表
- 表格展示所有记录
- 支持编辑和删除
- 分页加载 (每页 20 条)
- 类型标签 (绿色收入/红色支出)
- 金额高亮显示

## 开发指南

### 本地开发设置

1. **克隆项目**
```bash
git clone <repository-url>
cd free-nextjs-admin-dashboard
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env.local
```

编辑 `.env.local`:
```bash
# 从 Vercel Dashboard 复制 KV 配置
KV_URL="redis://..."
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="..."
KV_REST_API_READ_ONLY_TOKEN="..."
```

4. **启动开发服务器**
```bash
npm run dev
```

访问: http://localhost:3000/finance

### 添加新功能

#### 示例: 添加标签筛选

1. **更新类型定义** (`src/types/finance.ts`)
```typescript
export interface FinanceQuery {
  tags?: string[];  // 新增
  // ... 其他字段
}
```

2. **更新数据层** (`src/lib/db/finance.ts`)
```typescript
export async function getRecords(query: FinanceQuery) {
  // 添加标签筛选逻辑
  const records = await fetchRecords();
  return records.filter(r => 
    !query.tags || r.tags?.some(t => query.tags.includes(t))
  );
}
```

3. **更新 API** (`src/app/api/finance/records/route.ts`)
```typescript
export async function GET(request: NextRequest) {
  const tags = searchParams.getAll('tags');
  const records = await getRecords({ tags });
  // ...
}
```

4. **更新 UI** (添加标签选择器)

### 测试

#### 单元测试 (待实现)
```bash
npm run test
```

#### API 测试
```bash
# 创建记录
curl -X POST http://localhost:3000/api/finance/records \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","amount":100,"category":"餐饮","date":"2025-11-09T00:00:00Z"}'

# 获取记录
curl http://localhost:3000/api/finance/records

# 获取统计
curl http://localhost:3000/api/finance/stats
```

## 扩展功能建议

### 1. 高级筛选
- [ ] 按分类筛选
- [ ] 按日期范围筛选
- [ ] 按金额范围筛选
- [ ] 多条件组合筛选

### 2. 图表可视化
- [ ] 月度收支趋势图 (折线图)
- [ ] 分类占比饼图
- [ ] 年度对比柱状图
- [ ] 收支日历热力图

### 3. 数据导出
- [ ] 导出为 Excel
- [ ] 导出为 PDF
- [ ] 导出为 CSV
- [ ] 打印友好视图

### 4. 用户认证
- [ ] 登录/注册
- [ ] 多用户隔离
- [ ] 权限管理
- [ ] Session 管理

### 5. 移动端优化
- [ ] 响应式设计增强
- [ ] PWA 支持
- [ ] 离线模式
- [ ] 移动端手势

### 6. 自动化功能
- [ ] 定期生成报表
- [ ] 预算提醒
- [ ] 异常消费警告
- [ ] 邮件通知

## 性能优化

### 1. 数据层优化
```typescript
// 使用缓存
const CACHE_TTL = 60; // 60秒

export async function getStats(month: string) {
  const cached = await kv.get(`finance:stats:${month}`);
  if (cached) return cached;
  
  const stats = await calculateStats(month);
  await kv.set(`finance:stats:${month}`, stats, { ex: CACHE_TTL });
  return stats;
}
```

### 2. 前端优化
- 使用 React.memo 避免不必要的重渲染
- 虚拟滚动处理大列表
- 图片懒加载
- 代码分割

### 3. API 优化
- 分页查询减少数据传输
- 使用 Redis Pipeline 批量操作
- 添加请求缓存头
- 压缩响应数据

## 常见问题

### Q: 数据会丢失吗?
A: Vercel KV 有持久化保证,但建议定期备份重要数据。

### Q: 免费额度够用吗?
A: 对于中小企业(日均 200 条记录),完全够用。

### Q: 可以自定义分类吗?
A: 可以通过 API 添加自定义分类。

### Q: 支持多币种吗?
A: 目前只支持人民币,可扩展添加币种字段。

### Q: 能导出数据吗?
A: 可通过 API 获取所有数据并导出为 JSON。

## 代码规范

- 使用 ESLint + Prettier
- TypeScript 严格模式
- 组件使用函数式写法
- 遵循 Next.js 最佳实践

## 参考资源

- [Next.js 文档](https://nextjs.org/docs)
- [Vercel KV 文档](https://vercel.com/docs/storage/vercel-kv)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [ApexCharts 文档](https://apexcharts.com/docs)

---

更新时间: 2025-11-09
