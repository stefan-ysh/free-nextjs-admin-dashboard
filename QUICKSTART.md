# 财务管理系统 - 快速入门指南

## 🎯 5 分钟快速上手

### 步骤 1: 克隆项目

```bash
git clone <your-repository-url>
cd free-nextjs-admin-dashboard
```

### 步骤 2: 安装依赖

```bash
npm install
```

已安装的关键依赖:
- `next@15.2.3` - Next.js 框架
- `@vercel/kv` - Vercel KV SDK
- `apexcharts` - 图表库
- `tailwindcss@4.0.0` - 样式框架

### 步骤 3: 配置数据库

#### 选项 A: 使用 Vercel KV (推荐)

1. **创建 Vercel 账号**: https://vercel.com/signup

2. **创建 KV 数据库**:
   - 登录 Vercel Dashboard
   - 进入 Storage 标签
   - 点击 "Create Database" → 选择 "KV"
   - 命名为 `finance-records`
   - 选择最近的区域

3. **获取连接信息**:
   - 创建完成后,复制环境变量
   - 在本地创建 `.env.local`:

```bash
cp .env.example .env.local
```

4. **填入环境变量**:

编辑 `.env.local`:
```bash
KV_URL="redis://default:xxxxx@xxxxx.kv.vercel-storage.com:6379"
KV_REST_API_URL="https://xxxxx.kv.vercel-storage.com"
KV_REST_API_TOKEN="xxxxx"
KV_REST_API_READ_ONLY_TOKEN="xxxxx"
```

### 步骤 4: 启动开发服务器

```bash
npm run dev
```

打开浏览器访问: http://localhost:3000

### 步骤 5: 访问财务管理

1. 在侧边栏找到 **"财务管理"** 菜单项
2. 或直接访问: http://localhost:3000/finance

### 步骤 6: 添加第一条记录

1. 点击 **"+ 添加记录"** 按钮
2. 填写表单:
   - 类型: 选择 "收入" 或 "支出"
   - 金额: 输入数字 (如: 1000)
   - 分类: 从下拉菜单选择
   - 日期: 选择日期
   - 描述: 输入备注 (可选)
3. 点击 **"添加"** 按钮
4. 查看记录出现在列表中
5. 统计卡片自动更新

## 🎉 完成!

现在你可以:
- ✅ 添加、编辑、删除财务记录
- ✅ 查看实时统计数据
- ✅ 按分类管理收支
- ✅ 浏览历史记录

## 📱 功能演示

### 添加支出记录
```
类型: ● 支出
金额: 150.00 元
分类: 餐饮
日期: 2025-11-09
描述: 团队午餐
```

### 添加收入记录
```
类型: ● 收入
金额: 5000.00 元
分类: 工资
日期: 2025-11-09
描述: 月度工资
```

### 查看统计
```
┌────────────────────────────────────────────────┐
│  总收入: ¥5,000.00   总支出: ¥150.00          │
│  净收支: ¥4,850.00   记录数: 2                │
└────────────────────────────────────────────────┘
```

## 🚀 部署到生产环境

### 方式 1: 一键部署到 Vercel

1. 推送代码到 GitHub
2. 访问 [Vercel](https://vercel.com)
3. 点击 "Import Project"
4. 选择你的 GitHub 仓库
5. Vercel 自动检测 Next.js 项目
6. 在 Storage 中连接你的 KV 数据库
7. 点击 "Deploy"
8. 等待 2-3 分钟完成部署

### 方式 2: 使用 Vercel CLI

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

## 📚 下一步

### 学习更多
- 📖 [完整功能文档](./docs/FINANCE_MODULE.md)
- 🚀 [部署详细指南](./docs/DEPLOYMENT.md)
- ⚙️ [Vercel KV 配置](./docs/VERCEL_KV_SETUP.md)

### 扩展功能
- 添加图表可视化
- 导出 Excel 报表
- 设置预算提醒
- 多用户权限管理

### 自定义
- 修改默认分类
- 调整颜色主题
- 添加自定义字段
- 集成其他服务

## ❓ 常见问题

### Q: 本地开发需要 Vercel KV 吗?
A: 是的,需要创建 Vercel KV 数据库并配置环境变量。免费额度完全够用。

### Q: 数据存储在哪里?
A: 数据存储在 Vercel KV (Redis),云端托管,自动备份。

### Q: 免费版本有限制吗?
A: Vercel KV 免费版提供 256MB 存储和每月 10 万次请求,适合中小型使用。

### Q: 可以离线使用吗?
A: 目前需要网络连接访问 KV 数据库,未来可以添加 PWA 支持。

### Q: 如何备份数据?
A: Vercel KV 自动备份。你也可以通过 API 导出所有数据为 JSON。

## 🆘 遇到问题?

1. **检查环境变量**: 确认 `.env.local` 配置正确
2. **查看控制台**: 打开浏览器开发者工具查看错误
3. **重启服务**: 修改环境变量后需要重启 `npm run dev`
4. **查看文档**: 阅读 `docs/` 目录下的详细文档
5. **提交 Issue**: 在 GitHub 上报告问题

## 📮 技术支持

- 📖 查看文档: `docs/FINANCE_MODULE.md`
- 🐛 报告 Bug: GitHub Issues
- 💡 功能建议: GitHub Discussions
- 📧 邮件联系: (添加你的邮箱)

---

**祝使用愉快! 🎊**

有任何问题欢迎随时咨询!
