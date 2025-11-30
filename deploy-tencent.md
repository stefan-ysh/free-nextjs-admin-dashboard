# 腾讯云部署指南 (Tencent Cloud Deployment Guide) - 新手版

本指南将手把手教您将 Next.js 应用部署到腾讯云服务器 (CVM 或 Lighthouse)。

## 1. 准备工作 (Prerequisites)

### 1.1 购买服务器
如果您还没有服务器，可以在腾讯云购买：
-   **轻量应用服务器 (Lighthouse)**: 适合新手和个人项目，配置简单，性价比高。推荐选择 **Docker** 应用镜像，这样就不用自己安装 Docker 了。
-   **云服务器 (CVM)**: 适合更复杂的业务场景。

### 1.2 连接服务器
您可以使用腾讯云控制台的 "登录" 按钮，或者在本地终端使用 SSH 连接：
```bash
ssh root@your_server_ip
# 输入密码登录
```

### 1.3 安装 Docker (如果服务器没装)
在终端输入 `docker -v`，如果显示版本号说明已安装。如果没有，请按以下步骤安装：

**Ubuntu 系统:**
```bash
curl -fsSL https://get.docker.com | sh
```

**CentOS 系统:**
```bash
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker
```

## 2. 部署步骤 (Step-by-Step Deployment)

### 2.1 上传代码
您可以使用 Git 拉取代码 (推荐)，或者使用 SFTP 工具 (如 FileZilla) 上传文件。
确保服务器上有 `Dockerfile`, `package.json`, `next.config.ts`, `public/` 目录以及 `src/` 源码。

### 2.2 配置环境变量
在项目根目录创建一个名为 `.env.local` 的文件，填入您的配置。
可以使用 `vim` 编辑器：
```bash
vim .env.local
```
按 `i` 进入编辑模式，粘贴以下内容 (修改为您自己的配置)：
```bash
# 数据库配置
MYSQL_HOST="127.0.0.1"  # 如果数据库也在本机，用这个；如果是云数据库，填内网 IP
MYSQL_PORT="3306"
MYSQL_USER="root"
MYSQL_PASSWORD="your_password"
MYSQL_DATABASE="your_database"

# NextAuth 认证配置 (必须)
NEXTAUTH_URL="http://your_server_ip:3000" # 换成您的服务器公网 IP
NEXTAUTH_SECRET="random_string_here" # 随便填一个长一点的随机字符串
```
按 `Esc`，然后输入 `:wq` 并回车保存退出。

### 2.3 构建 Docker 镜像 (Build Image)
这一步会将您的代码打包成一个 "镜像" (Image)，就像把应用程序打包成一个安装包。

在项目根目录下运行：
```bash
docker build -t nextjs-admin .
```
-   `docker build`: 构建命令。
-   `-t nextjs-admin`: 给这个镜像起个名字叫 `nextjs-admin`。
-   `.`: 告诉 Docker 在当前目录寻找 `Dockerfile`。

*注意：第一次构建可能需要几分钟，请耐心等待。*

### 2.4 运行容器 (Run Container)
这一步是把刚才打包好的 "镜像" 运行起来，变成一个 "容器" (Container)。

```bash
docker run -d -p 3000:3000 --name my-app --env-file .env.local --restart always nextjs-admin
```

**命令详解 (新手必看):**
-   `docker run`: 运行一个容器。
-   `-d`: **后台运行** (Detached mode)。容器会在后台默默工作，不会占用您的终端窗口。
-   `-p 3000:3000`: **端口映射**。把服务器的 3000 端口 (左边) 映射到容器内部的 3000 端口 (右边)。这样您访问服务器 IP:3000 就能访问到容器里的应用了。
-   `--name my-app`: 给这个运行的容器起个名字叫 `my-app`，方便以后管理。
-   `--env-file .env.local`: 让容器读取我们刚才创建的配置文件。
-   `--restart always`: **自动重启**。如果服务器重启了，或者应用崩溃了，Docker 会自动把它重新启动起来，非常省心。
-   `nextjs-admin`: 使用我们刚才构建的那个镜像。

### 2.5 验证
在浏览器输入 `http://您的服务器IP:3000`，应该就能看到登录页面了！

## 3. 常用管理命令 (Management)

以后您可能需要管理这个应用，这里有一些常用命令：

-   **查看正在运行的容器**:
    ```bash
    docker ps
    ```
-   **查看应用日志** (如果报错了用这个看):
    ```bash
    docker logs my-app
    # 或者实时查看最后100行日志
    docker logs -f --tail 100 my-app
    ```
-   **停止应用**:
    ```bash
    docker stop my-app
    ```
-   **删除应用** (删除后可以重新运行):
    ```bash
    docker rm my-app
    ```
-   **更新代码后重新部署**:
    1.  `git pull` (拉取新代码)
    2.  `docker build -t nextjs-admin .` (重新构建镜像)
    3.  `docker stop my-app` (停止旧容器)
    4.  `docker rm my-app` (删除旧容器)
    5.  运行 `docker run ...` 命令 (启动新容器)

## 4. 常见问题 (Troubleshooting)

-   **访问不了？**
    -   检查腾讯云控制台的 **防火墙** (或安全组) 设置，确保 **3000** 端口是开放的 (TCP 协议)。
-   **构建时内存不足？**
    -   Next.js 构建比较吃内存。如果服务器只有 1G 内存，可能会失败。
    -   **解决方法**: 在本地电脑构建好镜像，推送到 Docker Hub，然后在服务器上拉取运行。或者给服务器增加 Swap (虚拟内存)。

## 5. 进阶：使用 Docker Compose (推荐)

如果您觉得每次输入长长的 `docker run` 命令很麻烦，可以使用 `docker-compose`。

1.  **准备**: 确保服务器安装了 Docker Compose (通常安装 Docker Desktop 或较新版本的 Docker Engine 会自带)。
2.  **文件**: 确保项目根目录有 `docker-compose.yml` 文件。
3.  **启动**:
    ```bash
    docker compose up -d
    ```
    这就完了！它会自动构建镜像、启动容器、映射端口 (3000)、并加载环境变量。

4.  **停止**:
    ```bash
    docker compose down
    ```
