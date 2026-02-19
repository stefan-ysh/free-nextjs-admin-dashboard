# 腾讯云部署与环境变量配置指南

本文档将指导您如何在腾讯云的不同服务（CVM、LightHouse、容器服务等）中正确配置环境变量。

## ⚠️ 重要说明
项目根目录下的 `.env.local` 文件仅用于**本地开发**，**不要**将其上传到生产服务器或是代码仓库中。生产环境应使用环境变量注入的方式进行配置。

## 1. 准备工作

首先，参考项目根目录下的 `.env.example` 文件，整理好您生产环境所需的变量值。

关键变量包括：
- **数据库连接** (`MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD` 等)
- **NextAuth 秘钥** (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`)
- **对象存储** (如果使用 COS)
- **邮件服务** (SMTP 等)

---

## 2. 针对不同服务的配置方法

### 场景 A: 云服务器 (CVM) / 轻量应用服务器 (Lighthouse) - Node.js 直接部署

如果您是直接在服务器上通过 `npm run start` 或 `pm2` 运行项目：

#### 方法 1:创建生产环境 .env 文件 (最简单)
在服务器的项目根目录下，创建一个名为 `.env.production` 或 `.env` 的文件，并将配置写入其中。Next.js 会自动加载它。

```bash
# 在服务器上
cd /path/to/your/project
vim .env.production
# 粘贴您的环境变量内容
```

#### 方法 2: 使用 PM2 生态系统文件 (推荐)
如果您使用 PM2 管理进程，建议创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps : [{
    name   : "admin-dashboard",
    script : "npm",
    args   : "start",
    env_production: {
      NODE_ENV: "production",
      MYSQL_HOST: "10.0.0.5",
      MYSQL_USER: "root",
      // ... 其他变量
    }
  }]
}
```
启动时运行: `pm2 start ecosystem.config.js --env production`

---

## 3. 初始化默认管理员账号

在首次部署成功后，您可能需要初始化一个默认的管理员账号。

**操作步骤：**

1. 确保环境变量 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 已配置（或者使用默认值）。
2. 在服务器项目目录下运行：

```bash
npm run seed:init-admin
```

如果账号已存在，脚本会自动跳过，因此可以在每次部署后安全运行。

## 4. 常见问题

**Q: 为什么修改了环境变量没生效？**
A: Next.js 在构建时 (`npm run build`) 会将部分环境变量（以 `NEXT_PUBLIC_` 开头的）打包进前端代码。如果您修改了这些变量，**必须重新构建项目**。对于后端使用的变量（如数据库密码），重启服务即可。

**Q: 数据库连接失败？**
A: 请检查腾讯云的安全组设置，确保数据库端口 (默认 3306) 对应用服务器开放。如果是内网通信，请使用内网 IP (如 `10.0.x.x`)。
