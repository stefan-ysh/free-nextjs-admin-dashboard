# 财务管理系统 - Next.js Admin Dashboard

基于 TailAdmin Next.js 模板打造的企业财务与采购一体化后台,已经完成“完全本地化”改造: 所有结构化数据写入自建数据库,附件与头像都落地到本机磁盘,不再依赖 Vercel KV / Blob 等云端服务。

## ✨ 模块亮点
- 📊 **收支记录**: 收入/支出全量信息、合同金额、手续费、发票等字段一次性管理
- 📁 **本地文件存储**: 附件写入 `LOCAL_STORAGE_ROOT`, 支持自定义目录与备份策略
- 🧾 **采购/项目联动**: 采购、项目、员工与财务模块统一运行在本地 MySQL, 数据同源方便统计与审计

- 🔐 **自托管认证**: NextAuth + MySQL, 通过 `npm run seed:admin` 快速创建管理员
- 🌓 **深色模式与中文 UI**: 组件、图表、表单、日期选择器都对深色模式与中文本地化做了适配

## 🧱 技术栈
- **框架**: Next.js 15 (App Router) + React 19 + TypeScript
- **样式**: Tailwind CSS v4
- **数据库**: MySQL (财务 / 采购 / 项目 / 认证 全量数据)
- **文件存储**: 本地文件系统 (`LOCAL_STORAGE_ROOT`)
- **图表**: ApexCharts、JSVectorMap

## 📦 快速开始

```bash
git clone https://github.com/stefan-ysh/free-nextjs-admin-dashboard.git
cd free-nextjs-admin-dashboard
npm install
cp .env.example .env.local
```

1. **准备数据库**
    - 启动本地 MySQL,创建数据库 `tailadmin_local`
2. **配置环境变量**
    - 根据 `.env.example` 填写 `MYSQL_*`/`MYSQL_URL`
    - 可选: 自定义 `LOCAL_STORAGE_ROOT`
3. **创建管理员 (可选)**
    ```bash
    npm run seed:admin -- admin@example.com SuperSecurePass finance_admin
    ```
4. **启动开发服务器**
    ```bash
    npm run dev
    ```
    访问 http://localhost:3000/finance

所有表结构在第一次访问 API 时会自动创建,无需额外迁移脚本。

### 🔐 管理员账号 & 密码

1. **初始化管理员**
    ```bash
    npm run seed:admin -- admin@example.com SuperSecurePass finance_admin
    ```
    - 第 1 个参数是邮箱,登录名将自动转小写
    - 第 2 个参数是明文密码,脚本会在数据库里保存 bcrypt 哈希
    - 第 3 个参数为角色(可选),支持 `super_admin|admin|finance_admin|finance|hr|department_manager|staff|employee`, 不填默认 `finance_admin`

2. **重置/修改密码**
    - **推荐**: 删除原账号后重新执行 `seed:admin`
      ```sql
      DELETE FROM auth_users WHERE email = 'admin@example.com';
      ```
    - **或直接更新哈希**:
      1. 生成新哈希 (示例)
          ```bash
          node -e "console.log(require('bcryptjs').hashSync('NewPass123', 12))"
          ```
      2. 在 MySQL 中写回
          ```sql
          UPDATE auth_users SET password_hash = '<新哈希>' WHERE email = 'admin@example.com';
          ```

3. **排障**
    - 如果脚本提示 “邮箱已存在”, 先删除再创建
    - 如果连不上数据库, 检查 `.env.local` 中 `MYSQL_URL`/`MYSQL_*` 是否正确

## 🗄️ 数据落地策略
| 模块 | 数据源 | 说明 |
|------|--------|------|
| 财务 (finance) | MySQL | `src/lib/db/finance.ts` + `src/lib/schema/finance.ts` 自动建表,适合大批量统计查询 |
| 采购 / 项目 / 员工 / 认证 | MySQL | 与财务模块共享 `mysql2/promise` 连接,访问统一的结构化数据 |
| 附件 / 头像 | 本地文件夹 | 由 `src/lib/storage/local.ts` 统一管理,对外暴露 `/api/files/*` 访问路径 |

更多细节参阅 [docs/LOCAL_STORAGE_SETUP.md](./docs/LOCAL_STORAGE_SETUP.md)。

## 📖 相关文档
- [FINANCE_MODULE.md](./docs/FINANCE_MODULE.md): 财务模块开发说明
- [LOCAL_STORAGE_SETUP.md](./docs/LOCAL_STORAGE_SETUP.md): 本地文件目录与权限
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md): 本地 / 自托管部署示例
- [FINANCE_UI_UPDATE.md](./docs/FINANCE_UI_UPDATE.md): UI & 交互调整记录
- [DEV_STATUS.md](./docs/DEV_STATUS.md): 当前开发状态与测试项

## 📁 项目结构 (核心部分)
```
src/
├── app/
│   ├── api/
│   │   ├── finance/records|stats|categories/route.ts      # MySQL + 本地附件
│   │   ├── purchases/… / projects/… / employees/…         # MySQL
│   └── (admin)/finance/page.tsx                           # 财务页面
├── components/finance/                                     # 表单、表格、上传等组件
├── lib/
│   ├── mysql.ts                                           # 数据库连接
│   ├── db/finance|projects|purchases.ts                    # DAO 层
│   ├── schema/*                                            # 自动建表脚本
│   └── storage/local.ts                                    # 本地文件操作
└── scripts/create-admin.mjs                                # 管理员种子脚本 (MySQL)
```

## 🔧 API 速览
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/finance/records` | 分页查询财务记录 (`startDate/endDate/limit/offset` 参数) |
| POST | `/api/finance/records` | 新建记录 (自动计算 `totalAmount`) |
| PATCH | `/api/finance/records/[id]` | 更新记录并同步附件 |
| DELETE | `/api/finance/records/[id]` | 删除记录、同时删除本地文件 |
| GET | `/api/finance/stats` | 汇总统计 + 分类占比 |
| GET/POST | `/api/finance/categories` | 查询/新增分类 |

采购、项目、人员等 API 请参考 `src/app/api/*` 目录。

## 🖥️ 部署 / 自托管
我们优先支持下述两种方式,详见 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md):
1. **个人电脑 / 私有服务器**: Node.js 进程 + Nginx 反代 + systemd/PM2 常驻
2. **Docker / Compose**: 将 MySQL、Next.js 放在同一台机器,完全断网也可使用

如果未来需要接入 Vercel / Cloudflare,可以在自托管版本稳定后再扩展远程存储,但默认模板不再强制依赖任何云厂商。

## 🙋 常见问题
- **还需要安装多种数据库吗?** 不需要, 现在所有模块都运行在 MySQL 上, 只安装一个数据库即可。
- **附件存在哪里?** 默认在 `~/Documents/free-nextjs-admin-storage`,通过 `LOCAL_STORAGE_ROOT` 可修改。
- **如何备份?** 使用 `mysqldump` 导出数据库,配合 rsync/TimeMachine 备份文件目录即可。
- **还能用远程 KV 吗?** 相关代码已移除,如需云端方案可自行接入 S3、Supabase Storage 等服务。

## 📝 开源协议
MIT License (沿用 TailAdmin 模板授权)。欢迎提交 Issue / PR 帮助完善本地化版本。

---

```bash
npm run dev
# or
npm run build && npm start
```

打开 http://localhost:3000/finance 立即体验私有化财务后台 🚀
│   ├── FinanceTable.tsx          # 记录列表
