# 财务管理系统部署指南（本地 / 自托管）

本指南聚焦“完全本地化”部署方案，帮助你在无外网或内网环境中运行整套后台系统。所有示例均以 macOS/Linux 为例，Windows 用户可以使用 WSL 或 PowerShell 执行等价命令。

---

## 1. 环境准备

| 组件 | 建议版本 | 说明 |
|------|----------|------|
| Node.js | ≥ 18.18 (建议 20+) | 运行 Next.js 服务端 |
| npm / pnpm | 最新稳定版 | 管理依赖与脚本 |
| MySQL | 8.x | 财务、采购、项目、认证等结构化数据 |
| Git | 任意稳定版 | 拉取代码与后续更新 |

> 数据库可以安装在同一台机器，也可以指向局域网中的独立数据库服务器。

---

## 2. 单机部署（systemd / PM2）

1. **克隆并安装依赖**
   ```bash
   git clone https://github.com/stefan-ysh/free-nextjs-admin-dashboard.git
   cd free-nextjs-admin-dashboard
   npm install
   ```
2. **创建 `.env.local`**（参考仓库中的 `.env.example`）
   ```ini
  MYSQL_URL="mysql://root:changeme@127.0.0.1:3306/tailadmin_local?timezone=Z"
  LOCAL_STORAGE_ROOT="/srv/tailadmin/storage"
   ```
3. **启动数据库服务并创建库**
   ```bash
  mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS tailadmin_local CHARACTER SET utf8mb4;"
   ```
4. **构建并启动**
   ```bash
   npm run build
   npm run start   # 默认监听 0.0.0.0:3000，可通过 PORT 指定端口
   ```
5. **常驻运行示例（systemd）**
   ```ini
   # /etc/systemd/system/tailadmin.service
   [Unit]
   Description=TailAdmin Finance
   After=network.target

   [Service]
   WorkingDirectory=/opt/free-nextjs-admin-dashboard
   Environment=NODE_ENV=production
   Environment=PORT=3000
   EnvironmentFile=/opt/free-nextjs-admin-dashboard/.env.local
   ExecStart=/usr/bin/npm start
   Restart=always
   User=www-data

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable tailadmin --now
   ```
6. **使用 PM2 的示例**
   ```bash
   npm install -g pm2
   pm2 start npm --name tailadmin -- start
   pm2 save
   pm2 startup    # 生成自启动脚本
   ```

将 Nginx/SWAG/Caddy 等反向代理至 `http://127.0.0.1:3000` 即可实现 HTTPS 访问。

---

## 3. Docker Compose 部署

```yaml
version: '3.9'
services:
  mysql:
    image: mysql:8.2
    container_name: tailadmin-mysql
    environment:
      MYSQL_ROOT_PASSWORD: changeme
      MYSQL_DATABASE: tailadmin_local
    volumes:
      - ./data/mysql:/var/lib/mysql
    ports:
      - "3306:3306"

  app:
    build: .
    container_name: tailadmin-app
    depends_on:
      - mysql
    environment:
      NODE_ENV: production
      MYSQL_URL: mysql://root:changeme@mysql:3306/tailadmin_local?timezone=Z
      LOCAL_STORAGE_ROOT: /data/storage
    volumes:
      - ./storage:/data/storage
    ports:
      - "3000:3000"
```

```bash
docker compose build app
docker compose up -d
```

- 构建阶段请确保 `Dockerfile` 中执行了 `npm install` 与 `npm run build`
- `LOCAL_STORAGE_ROOT` 映射到宿主机，方便备份与离线访问

---

## 4. 本地文件存储加固

1. 将 `LOCAL_STORAGE_ROOT` 指向 RAID/NAS 等可靠介质
2. 为 `/api/files` 提供只读 Nginx 反向代理，限制外部写入
3. 若部署在多节点，可将该目录挂载在 NFS/Samba 或对象存储网关上
4. 参考 [LOCAL_STORAGE_SETUP.md](./LOCAL_STORAGE_SETUP.md) 获取更细的目录结构说明

---

## 5. 备份与恢复

| 类型 | 命令 |
|------|------|
| MySQL | `mysqldump -uroot -p tailadmin_local > backup/mysql-$(date +%F).sql` |
| 附件 | `rsync -av --delete /srv/tailadmin/storage backup/storage/` |

恢复时按顺序导入数据库，再同步文件目录即可。

---

## 6. 常见问题排查

| 现象 | 处理建议 |
|------|-----------|
| `ECONNREFUSED MySQL` | 检查端口、防火墙，确认 `.env.local` 与数据库字符集一致 |
| `ER_ACCESS_DENIED_ERROR` | 使用 `mysql -u` 测试凭证，或为应用单独创建账号 |
| 附件 404 | 确认 `LOCAL_STORAGE_ROOT` 目录存在并赋予 Node 进程读写权限 |
| API 500（ER_NO_SUCH_TABLE） | 访问一次 `/api/finance/records` 或 `/finance` 页面触发表结构初始化 |
| Next.js 构建失败 | 删除 `.next`、`node_modules` 重新 `npm install && npm run build` |

---

## 7. 可选：远程部署思路

虽然当前版本专注本地化，但仍可按以下方式接入云端：
- 将 MySQL 指向云数据库（RDS、TiDB Cloud 等）
- 使用对象存储（S3、MinIO、阿里云 OSS）替换 `LOCAL_STORAGE_ROOT`
- 使用 CI/CD（GitHub Actions、自建 Jenkins）触发 `npm run build && npm run start`

请注意：若改为云端部署，需要重新评估网络延迟、出站带宽与安全策略，本指南不再详细展开。

---

## 8. 部署检查清单

- [ ] `.env.local` 中的 `MYSQL_*`、`LOCAL_STORAGE_ROOT` 均已配置
- [ ] 数据库可连通并已创建 `tailadmin_local`
- [ ] 首次访问 `/finance` 成功创建表结构
- [ ] `/api/files/*` 返回的附件可正常下载
- [ ] 反向代理或防火墙放通了外部访问端口
- [ ] 已配置定期备份（数据库 + 文件夹）

完成以上步骤即可获得一个完全离线、可持续维护的财务管理系统。祝部署顺利！
