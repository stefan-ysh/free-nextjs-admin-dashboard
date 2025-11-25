# 财务管理系统 - 开发文档

## 项目概述

在原有 Next.js Admin Dashboard 基础上新增财务记录管理功能,用于公司业务财务管理。

## 技术栈

- **框架**: Next.js 15+ (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **图表**: ApexCharts
- **数据存储**: 本地 MySQL + 文件系统
- **部署**: 本地或自托管

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

使用 MySQL 存储结构化数据,文件系统存放附件:

```
Table finance_records
  - id (varchar) 主键
  - name/type/category/date_value/contract_amount/fee/total_amount
  - payment_type/invoice_json/description/tags_json
  - created_by/created_at/updated_at

Table finance_categories
  - id/type/name/is_default/created_at

Local storage folders
  - avatars/
  - finance/attachments/
```

#### 为什么改用 MySQL + 本地存储?

- ✅ **数据完全自托管**: 不依赖云服务,隐私可控
- ✅ **查询能力强**: SQL 方便做条件检索/统计
- ✅ **部署简单**: MySQL + 文件夹即可
- ✅ **附件可离线访问**: 文件直接存在本地磁盘

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
- 数量字段 (支持小数，用于记账模板中的“数量”列)
- 备注描述 (多行文本)
- 支付方式 (支持公对公、公对私等，也可手动输入)
- 代付人 / 流水号字段，便于追踪“个人记账管理.xlsx”中记录的付款人和流水信息

#### 记录列表
- 表格展示所有记录
- 支持编辑和删除
- 分页加载 (每页 20 条)
- 类型标签 (绿色收入/红色支出)
- 金额高亮显示
- 快速筛选：收支类型、分类、金额区间与关键词搜索
- 新增显示数量、支付方式、代付人/流水号列，与 Excel 模板保持一致

#### 查询筛选
- URL 查询参数支持 `type`、`category`、`minAmount`、`maxAmount`、`keyword`
- 所有接口(`/finance` 页面以及 `/api/finance/records`、`/api/finance/stats`)都会尊重筛选条件
- 筛选与日期范围联动，确保统计卡片和列表数据保持一致

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
```ini
MYSQL_URL="mysql://user:password@127.0.0.1:3306/tailadmin_local"
# 或分别指定 MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE

LOCAL_STORAGE_ROOT="/Users/you/Documents/free-nextjs-admin-storage" # 可选
```

4. **启动开发服务器**
```bash
npm run dev
```

访问: http://localhost:3000/finance

### 批量导入 Excel 记录

现在可以直接导入 `个人记账管理 (3).xlsx` 内的账单:

```bash
# 确保 Excel 文件放在仓库根目录，或通过参数传入路径
npm run import:finance [可选:Excel文件路径]
```

脚本会自动:

- 解析 `个人账单记录` 工作表，并识别“明细、日期、分类、手续费、数量、支付方式、代付人、发票信息”等列
- 根据 `收支类型`、`款项类型` 自动映射为系统枚举
- 避免重复导入（同名 + 同日 + 同合同金额的记录会被跳过）
- 将数据标记为 `sourceType = import`, 方便后续追踪

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
  -d '{"name":"采购办公桌","type":"expense","contractAmount":1000,"fee":50,"category":"办公用品","date":"2025-11-09T00:00:00Z","paymentType":"full"}'

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
```sql
-- 使用索引优化常用查询
CREATE INDEX IF NOT EXISTS idx_finance_date ON finance_records(date_value);
CREATE INDEX IF NOT EXISTS idx_finance_type ON finance_records(type);
```

### 2. 前端优化
- 使用 React.memo 避免不必要的重渲染
- 虚拟滚动处理大列表
- 图片懒加载
- 代码分割

### 3. API 优化
- 分页查询减少数据传输
- 尽量复用服务端缓存数据结构
- 添加请求缓存头
- 压缩响应数据

## 常见问题

### Q: 数据会丢失吗?
A: 所有数据在 MySQL 和本地磁盘,建议定期使用 `mysqldump` + 文件夹备份。

### Q: 免费额度够用吗?
A: 本地部署没有额度限制,取决于你的机器资源。

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
- [MySQL 文档](https://dev.mysql.com/doc/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [ApexCharts 文档](https://apexcharts.com/docs)

---

更新时间: 2025-11-16
