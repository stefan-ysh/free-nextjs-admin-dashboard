# 财务管理系统部署指南

本文档详细说明如何将财务管理系统部署到 Vercel 或 Cloudflare Pages。

## 📦 部署前准备

### 1. 环境要求
- Node.js 18+ 
- npm 或 pnpm
- Git

### 2. 本地测试
```bash
# 安装依赖
npm install

# 创建环境变量文件
cp .env.example .env.local

# 本地运行测试
npm run dev
```

访问 http://localhost:3000/finance 测试财务管理功能

---

## 🚀 部署到 Vercel (推荐)

### 优势
- ✅ 完美支持 Next.js
- ✅ 自动 CI/CD
- ✅ 免费 KV 数据库
- ✅ 全球 CDN
- ✅ 自动 HTTPS

### 部署步骤

#### 1. 连接 GitHub 仓库

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "Add New" → "Project"
3. 导入你的 GitHub 仓库
4. 选择 `free-nextjs-admin-dashboard` 项目

#### 2. 配置项目

Vercel 会自动检测 Next.js 项目,无需额外配置:
- Framework Preset: **Next.js**
- Build Command: `npm run build`
- Output Directory: `.next`

#### 3. 创建 Vercel KV 数据库

1. 在项目设置中,找到 **Storage** 标签
2. 点击 **Create Database**
3. 选择 **KV** (Redis)
4. 命名数据库: `finance-records`
5. 选择区域 (推荐: 就近选择)
6. 点击 **Create**

#### 4. 连接数据库到项目

1. 创建 KV 后,Vercel 会自动添加环境变量:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

2. 这些环境变量会自动注入到你的部署中

#### 5. 部署

点击 **Deploy** 按钮,等待构建完成 (通常 1-3 分钟)

#### 6. 验证部署

1. 访问 Vercel 提供的 URL (如: `https://your-project.vercel.app`)
2. 打开 `/finance` 页面
3. 尝试添加一条财务记录
4. 检查数据是否保存成功

### Vercel KV 免费额度

| 指标 | 免费额度 |
|------|---------|
| 存储空间 | 256 MB |
| 每日请求 | 30,000 次 |
| 每月请求 | 100,000 次 |
| 带宽 | 无限制 |

**适用场景**: 中小型企业,日均 100-500 条财务记录

### 自定义域名 (可选)

1. 在项目设置中,找到 **Domains**
2. 添加你的域名
3. 按照提示配置 DNS 记录
4. 等待 SSL 证书自动签发

---

## ☁️ 部署到 Cloudflare Pages

### 优势
- ✅ 更大的免费 KV 存储 (1GB)
- ✅ 全球边缘网络
- ✅ DDoS 保护
- ✅ 免费 SSL

### 部署步骤

#### 1. 准备项目

由于 Cloudflare Pages 使用不同的 KV API,需要修改数据层:

```bash
# 安装 Cloudflare Workers 适配器
npm install @cloudflare/workers-types
```

#### 2. 修改 KV 实现

创建 `src/lib/db/finance-cloudflare.ts` (适配 Cloudflare KV):

```typescript
// Cloudflare KV 绑定
interface Env {
  FINANCE_RECORDS: KVNamespace;
}

// 使用 Cloudflare KV API
export async function createRecord(record: FinanceRecord, env: Env) {
  const id = generateId();
  await env.FINANCE_RECORDS.put(`record:${id}`, JSON.stringify(record));
  return record;
}
```

#### 3. 连接 GitHub

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 点击 **Create Application** → **Pages** → **Connect to Git**
4. 选择你的 GitHub 仓库

#### 4. 配置构建

- Build command: `npm run build`
- Build output directory: `.next`
- Framework preset: **Next.js**

#### 5. 创建 KV Namespace

```bash
# 使用 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 创建 KV namespace
wrangler kv:namespace create "FINANCE_RECORDS"
```

#### 6. 绑定 KV 到 Pages

1. 在 Pages 项目设置中,找到 **Functions** → **KV namespace bindings**
2. 添加绑定:
   - Variable name: `FINANCE_RECORDS`
   - KV namespace: 选择你创建的 namespace

#### 7. 部署

推送代码到 GitHub,Cloudflare 会自动构建和部署

### Cloudflare KV 免费额度

| 指标 | 免费额度 |
|------|---------|
| 存储空间 | 1 GB |
| 每日读取 | 100,000 次 |
| 每日写入 | 1,000 次 |
| 每日删除 | 1,000 次 |

**适用场景**: 读多写少的场景,适合报表查询频繁的企业

---

## 🔐 环境变量配置

### 必需的环境变量

```bash
# Vercel KV (部署到 Vercel 时)
KV_URL=redis://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...

# 应用配置
NEXT_PUBLIC_APP_NAME=财务管理系统
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 设置环境变量

**Vercel**:
1. 项目设置 → **Environment Variables**
2. 添加变量
3. 选择环境: Production, Preview, Development

**Cloudflare**:
1. Pages 项目 → **Settings** → **Environment Variables**
2. 添加变量
3. 重新部署生效

---

## 🔧 故障排查

### 1. API 路由 404 错误

**症状**: 访问 `/api/finance/*` 返回 404

**解决**:
- 确认 API 路由文件在 `src/app/api/finance/` 目录
- 检查 Next.js 版本是否支持 App Router
- 查看构建日志中是否有错误

### 2. KV 连接失败

**症状**: 无法保存数据,控制台报错

**解决**:
- 检查环境变量是否正确设置
- 确认 KV 数据库已创建并连接到项目
- 查看 Vercel/Cloudflare 日志

### 3. 本地开发无法连接 KV

**症状**: 本地运行时无法保存数据

**解决**:
- 确认 `.env.local` 文件存在且配置正确
- 从 Vercel Dashboard 复制正确的环境变量
- 重启开发服务器

---

## 📊 监控和维护

### Vercel Analytics

1. 在项目中启用 **Analytics**
2. 查看页面访问量和性能指标
3. 监控 API 响应时间

### KV 使用量监控

**Vercel**:
- Dashboard → Storage → KV → Usage

**Cloudflare**:
- Workers & Pages → KV → Analytics

### 备份策略

建议定期导出数据:

```typescript
// 创建备份 API
export async function GET() {
  const records = await getAllRecords();
  return new Response(JSON.stringify(records), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename=backup.json'
    }
  });
}
```

---

## 🎯 性能优化建议

1. **启用缓存**: 对统计数据使用 Redis TTL
2. **分页查询**: 大数据量时限制每页记录数
3. **索引优化**: 使用 Sorted Set 加速时间范围查询
4. **图片优化**: 使用 Next.js Image 组件
5. **CDN 加速**: 静态资源使用 Vercel/Cloudflare CDN

---

## 📝 更新部署

### 自动部署 (推荐)

推送到 GitHub 主分支会自动触发部署:

```bash
git add .
git commit -m "Update finance module"
git push origin main
```

### 手动部署

**Vercel**:
```bash
npm install -g vercel
vercel --prod
```

**Cloudflare**:
```bash
npm install -g wrangler
wrangler pages publish .next
```

---

## 🆘 技术支持

遇到问题?

1. 查看 [Next.js 文档](https://nextjs.org/docs)
2. 查看 [Vercel KV 文档](https://vercel.com/docs/storage/vercel-kv)
3. 查看 [Cloudflare KV 文档](https://developers.cloudflare.com/workers/runtime-apis/kv/)
4. 提交 GitHub Issue

---

## 🎉 部署完成!

访问你的财务管理系统:
- 生产环境: `https://your-domain.com/finance`
- 登录后台添加第一条财务记录
- 查看统计数据和图表

祝使用愉快! 🚀
