# Vercel KV 配置说明

本项目使用 Vercel KV (Redis) 作为数据存储方案。

## 设置步骤

### 1. 在 Vercel 创建 KV 数据库

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 进入你的项目
3. 点击 "Storage" 标签
4. 点击 "Create Database"
5. 选择 "KV" (Redis)
6. 命名数据库 (如: `cosmorigin-admin-records`)
7. 选择区域 (建议选择离你最近的区域)
8. 点击 "Create"

### 2. 配置环境变量

Vercel 会自动将以下环境变量添加到你的项目:

```
KV_URL=redis://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

### 3. 本地开发

创建 `.env.local` 文件并从 Vercel 复制环境变量:

```bash
# 从 Vercel Dashboard > Settings > Environment Variables 复制
KV_URL="redis://..."
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="..."
KV_REST_API_READ_ONLY_TOKEN="..."
```

## Vercel KV 免费额度

- 256MB 存储空间
- 每天 30,000 次请求
- 每月 100,000 次请求
- 适合中小型项目使用

## Cloudflare Workers KV 替代方案

如果选择部署到 Cloudflare Pages:

### 免费额度
- 1GB 存储空间
- 每天 100,000 次读取
- 每天 1,000 次写入
- 每天 1,000 次删除

### 配置步骤
1. 创建 KV namespace: `wrangler kv:namespace create "FINANCE_RECORDS"`
2. 在 `wrangler.toml` 添加配置
3. 使用 `@cloudflare/workers-types` 访问 KV

## 数据结构设计

### Redis Keys 设计

```
finance:records:{id}           - 单条财务记录
finance:records:list          - 所有记录ID列表 (Sorted Set, 按时间排序)
finance:categories:{type}     - 分类列表 (Hash)
finance:stats:monthly:{YYYY-MM} - 月度统计缓存
```

## 安装依赖

```bash
npm install @vercel/kv
```

## 使用示例

```typescript
import { kv } from '@vercel/kv';

// 保存记录
await kv.set('finance:records:123', record);

// 获取记录
const record = await kv.get('finance:records:123');

// 添加到排序集合
await kv.zadd('finance:records:list', {
  score: Date.now(),
  member: '123'
});
```
