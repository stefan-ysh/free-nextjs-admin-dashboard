# 本地 MySQL + 文件系统配置说明

新版财务模块完全运行在本地环境，不再依赖 Vercel KV 或 Blob。所有结构化数据写入本地 MySQL，文件与图片保存在文稿目录（或你自定义的目录）下。

## 1. 安装并启动 MySQL

### macOS (Homebrew)
```bash
brew install mysql
brew services start mysql
```

### 初始化数据库
```sql
CREATE DATABASE IF NOT EXISTS admin_cosmorigin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cosmorigin'@'localhost' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON admin_cosmorigin.* TO 'cosmorigin'@'localhost';
FLUSH PRIVILEGES;
```

## 2. 配置环境变量

项目根目录创建 `.env.local`：

```ini
MYSQL_URL="mysql://cosmorigin:change-me@127.0.0.1:3306/admin_cosmorigin"
# 或分别指定
# MYSQL_HOST=127.0.0.1
# MYSQL_PORT=3306
# MYSQL_USER=cosmorigin
# MYSQL_PASSWORD=change-me
# MYSQL_DATABASE=admin_cosmorigin

# 可选：指定文件实际保存目录（默认 ~/Documents/admin_cosmorigin-storage）
LOCAL_STORAGE_ROOT="/Users/you/Documents/admin_cosmorigin-storage"
```

应用会在首次访问财务/头像相关功能时自动创建：

- `finance_records`：财务流水与发票信息
- `finance_categories`：收入/支出分类（预置 + 自定义）

## 3. 文件与图片存储

- 默认路径：`~/Documents/admin_cosmorigin-storage`
- 头像、发票附件等全部通过 `/api/files/...` 访问
- 删除记录或更新附件时会同步清理对应文件

自定义目录结构示例：
```
<root>
├── avatars/
└── finance/
    └── attachments/
```

## 4. 运行与调试

1. 启动 MySQL 并确认连接正常
2. `npm install`（已包含 `mysql2` 与 `mime` 依赖）
3. `npm run dev`
4. 首次访问财务模块会自动建表并注入默认分类

## 5. 常见问题

| 问题 | 解决方案 |
| --- | --- |
| `ECONNREFUSED 127.0.0.1:3306` | 确认 MySQL 服务已启动，或更新 `MYSQL_HOST/MYSQL_PORT` |
| `ER_ACCESS_DENIED_ERROR` | 检查用户名/密码，并确保授予对应数据库权限 |
| 附件无法访问 | 确认 `LOCAL_STORAGE_ROOT` 可读写，且请求走 `/api/files/...` |
| 旧版 Vercel Blob 文件如何迁移？ | 重新上传，或手动放入本地目录并更新记录路径 |

## 6. 迁移提示

- 删除 `.env.local` 中旧的 `KV_*`、`BLOB_*` 配置
- 若之前部署在 Vercel，本方案默认“本地自用”，不再依赖云端服务
- 使用 `mysqldump` 等工具即可对数据做定期备份
