# 财务管理系统 - 快速入门指南

本指南帮助你在 **完全离线 / 本地** 环境下把项目跑起来。

## 步骤 1: 克隆 & 安装依赖

```bash
git clone https://github.com/stefan-ysh/free-nextjs-admin-dashboard.git admin_cosmorigin
cd admin_cosmorigin
npm install
```

## 步骤 2: 准备数据库

### MySQL (全量数据)
```bash
# 以 Homebrew 为例
brew services start mysql
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS admin_cosmorigin CHARACTER SET utf8mb4;"
```

可以替换为 Docker、Windows 服务或远程自建数据库,只要连接字符串可用即可。

## 步骤 3: 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`:
```ini
# MySQL 连接(示例)
MYSQL_URL="mysql://root:changeme@127.0.0.1:3306/admin_cosmorigin?timezone=Z"

# 本地文件存储根目录 (可选)
LOCAL_STORAGE_ROOT="/Users/you/Documents/admin_cosmorigin-storage"
```

> 项目会根据这些变量自动创建连接池,无需额外迁移脚本。

## 步骤 4: (可选) 创建初始管理员

```bash
npm run seed:admin -- admin@example.com SuperSecurePass finance_admin
```

该脚本直接使用 MySQL 连接,不会访问任何云端依赖。

## 步骤 5: 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000/finance 即可体验财务模块。首次访问会自动建表:
- `finance_records` / `finance_categories`
- `projects` / `purchases` / `auth_users` 等

## 步骤 6: 上传附件 / 图片
- 所有文件默认写入 `~/Documents/admin_cosmorigin-storage`
- 可通过 `LOCAL_STORAGE_ROOT` 指向 NAS / 外置硬盘
- 访问路径统一为 `/api/files/<相对路径>`

## 权限与角色 (RBAC)

- 授权角色在 `src/lib/auth/roles.ts` 定义，前后台共享；`usePermissions` 钩子会把当前登录用户同步到前端，确保 UI 与 API 同步校验。
- `src/lib/permissions.ts` 列出了全部权限常量，若新增模块，请优先补充该文件并复用 `usePermissions`。

| 模块 | 查看权限 | 写入 / 操作权限 | 默认角色 |
| --- | --- | --- | --- |
| 财务 | `FINANCE_VIEW_ALL` | `FINANCE_MANAGE` (新增、更新、删除) | SUPER_ADMIN / ADMIN / FINANCE |
| 员工 | `USER_VIEW_ALL` | `USER_CREATE` / `USER_UPDATE` / `USER_DELETE` | SUPER_ADMIN / ADMIN / HR |
| 采购 | `PURCHASE_VIEW_ALL` 或 `PURCHASE_VIEW_DEPARTMENT` | `PURCHASE_CREATE`、`PURCHASE_UPDATE`、`PURCHASE_APPROVE` | SUPER_ADMIN / ADMIN / FINANCE / 部门经理 |

> ✅ 财务和员工模块已经完成前端权限兜底；采购模块的 UI 仍在搭建，但路由已根据权限过滤，未授权账号会看到提示页。

调试技巧:
- 通过 `npm run seed:admin` 创建 `super_admin`/`finance_admin` 账户，直接拥有全部或财务权限。
- 低权限/部门经理账号可以验证菜单、按钮、表单的显隐效果；若需要自定义权限，可在数据库中直接修改 `auth_users.role` 字段。

## 常见操作
- **添加记录**: 进入 `/finance` → 点击 “+ 添加记录”
- **查看统计**: 页面顶部的四张统计卡实时计算总收入/支出/余额
- **采购审批**: `/purchases` 模块共享同一个 MySQL 数据源,支出通过审批后会自动回写项目实际成本

## 遇到问题?
1. `ECONNREFUSED`: 确认数据库服务是否启动、端口是否正确
2. “缺少数据库连接字符串”: 检查 `.env.local` 是否被正确加载
3. 附件 404: 确认 `LOCAL_STORAGE_ROOT` 是否存在且拥有读写权限
4. 端口冲突: 修改 `package.json` 中 `dev` 命令或设置 `PORT=4000 npm run dev`

更多细节请阅读:
- [docs/FINANCE_MODULE.md](./docs/FINANCE_MODULE.md)
- [docs/LOCAL_STORAGE_SETUP.md](./docs/LOCAL_STORAGE_SETUP.md)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

祝开发顺利! 🚀
