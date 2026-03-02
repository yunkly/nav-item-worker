# Nav-item - 个人导航站

## 项目简介

一个现代化的导航网站项目，提供简洁美观的导航界面和强大的后台管理系统,快速访问常用网站和工具。

## 🛠️ 技术栈
- Vue 3 + Node.js + SQLite 前后端分离架构

## ✨ 主要功能

### 前端功能
- 🏠 **首页导航**：美观的卡片式导航界面
- 🔍 **聚合搜索**：支持 Google、百度、Bing、GitHub、站内搜索
- 📱 **响应式设计**：完美适配桌面端和移动端
- 🎨 **现代化UI**：采用渐变背景和毛玻璃效果
- 🔗 **友情链接**：支持友情链接展示
- 📢 **广告位**：支持左右两侧广告位展示

### 后台管理功能
- 👤 **用户管理**：管理员登录、用户信息管理
- 📋 **栏目管理**：主菜单和子菜单的增删改查
- 🃏 **卡片管理**：导航卡片的增删改查
- 📢 **广告管理**：广告位的增删改查
- 🔗 **友链管理**：友情链接的增删改查
- 📊 **数据统计**：登录时间、IP等统计信息

### 技术特性
- 🔐 **JWT认证**：安全的用户认证机制
- 🗄️ **SQLite数据库**：轻量级数据库，无需额外配置
- 📤 **文件上传**：支持图片上传功能
- 🔍 **搜索功能**：支持站内搜索和外部搜索
- 📱 **移动端适配**：完美的移动端体验

## 🏗️ 项目结构

```
nav-item/
├── app.js                 # 后端主入口文件
├── config.js             # 配置文件
├── db.js                 # 数据库初始化
├── package.json          # 后端依赖配置
├── database/             # 数据库文件目录
│   └── nav.db           # SQLite数据库文件
├── routes/               # 后端路由
│   ├── auth.js          # 认证相关路由
│   ├── menu.js          # 菜单管理路由
│   ├── card.js          # 卡片管理路由
│   ├── ad.js            # 广告管理路由
│   ├── friend.js        # 友链管理路由
│   ├── user.js          # 用户管理路由
│   └── upload.js        # 文件上传路由
├── uploads/              # 上传文件目录
│   └── default-favicon.png
├── web/                  # 前端项目目录
│    ├── package.json      # 前端依赖配置
│    ├── vite.config.mjs   # Vite配置文件
│    ├── index.html        # HTML入口文件
│    ├── public/           # 静态资源
│    │   ├── background.webp
│    │   ├── default-favicon.png
│    │   └── robots.txt
│    └── src/              # 前端源码
│        ├── main.js       # Vue应用入口
│        ├── router.js     # 路由配置
│        ├── api.js        # API接口封装
│        ├── App.vue       # 根组件
│        ├── components/   # 公共组件
│        │   ├── MenuBar.vue
│        │   └── CardGrid.vue
│        └── views/        # 页面组件
│            ├── Home.vue  # 首页
│            ├── Admin.vue # 后台管理
│            └── admin/    # 后台管理子页面
│                ├── MenuManage.vue
│                ├── CardManage.vue
│               ├── AdManage.vue
│               ├── FriendLinkManage.vue
│               └── UserManage.vue
├── Dockerfile # Docker构建文件
```

## ⚙️ 环境变量及配置说明

### 环境变量
- `PORT`: 服务器端口号（默认: 3000）
- `ADMIN_USERNAME`: 管理员用户名（默认: admin）
- `ADMIN_PASSWORD`: 管理员密码（默认: 123456）

### 数据库配置
系统使用 SQLite 数据库，数据库文件会自动创建在项目/database/目录下，使用docker部署请挂载/app/database目录实现数据持久化
```

## 🚀 部署指南

### Cloudflare Workers + D1 本地运行（推荐用于开发）

本项目已适配 **Cloudflare Workers + D1**，可按以下步骤在本地跑通前后端。

**1. 安装依赖**

```bash
# 根目录
npm install
cd web && npm install && cd ..
```

**2. 应用 D1 迁移（本地数据库）**

若本机有代理环境变量（如 `HTTP_PROXY=127.0.0.1:10808`），需先取消代理再执行，否则 Wrangler 可能报 `Invalid URL`：

```bash
# Windows PowerShell：临时清空代理
$env:HTTP_PROXY=''; $env:HTTPS_PROXY=''; $env:ALL_PROXY=''
npx wrangler d1 migrations apply nav-item --local
```

**3. 启动 Worker（终端一）**

```bash
$env:HTTP_PROXY=''; $env:HTTPS_PROXY=''; $env:ALL_PROXY=''
npm run dev:worker
```

看到 `Ready on http://127.0.0.1:8787` 即表示后端就绪。

**4. 启动前端（终端二）**

```bash
cd web
.\node_modules\.bin\vite --host
```

浏览器访问 **http://localhost:5173**。前端的 `/api` 请求会通过 Vite 代理到 `http://127.0.0.1:8787`，与 Worker + D1 联通。

- 默认管理员：**admin / 123456**

### 部署到 Cloudflare（线上）

一次部署即可同时提供 **API + 前端页面**（Worker 会托管 `web/dist` 静态资源），访问一个域名即可使用。

**1. 登录 Cloudflare**

```bash
npx wrangler login
```

**2. 创建 D1 数据库**

```bash
npx wrangler d1 create nav-item
```

命令会输出类似：

```
✅ Successfully created DB 'nav-item'
[[d1_databases]]
binding = "DB"
database_name = "nav-item"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**3. 填写 `wrangler.toml`**

在项目根目录打开 `wrangler.toml`，把上一步的 **`database_id`** 替换掉原来的占位 UUID：

```toml
[[d1_databases]]
binding = "DB"
database_name = "nav-item"
database_id = "这里填刚才输出的 database_id"
migrations_dir = "migrations"
```

**4. 应用 D1 迁移到线上**

有代理时先清空再执行（Windows PowerShell）：

```bash
$env:HTTP_PROXY=''; $env:HTTPS_PROXY=''; $env:ALL_PROXY=''
npx wrangler d1 migrations apply nav-item --remote
```

**5. 可选：R2 与上传**

- **不需要上传功能**：在 `wrangler.toml` 中注释掉整段 `[[r2_buckets]]`（否则部署会因找不到 bucket 报错）。
- **需要上传**：先创建 bucket：`npx wrangler r2 bucket create nav-item-uploads`，再在 [Cloudflare 控制台](https://dash.cloudflare.com) 为该 bucket 配置公网访问或自定义域名，并在 `wrangler.toml` 的 `[vars]` 中设置 `UPLOAD_PUBLIC_URL` 为该前缀（如 `https://你的域名/uploads/`）。

**6. 构建前端并部署 Worker**

```bash
# 安装依赖（若未执行过）
npm install
cd web && npm install && cd ..

# 构建前端 + 部署 Worker（会先生成 web/dist，再执行 wrangler deploy）
npm run deploy
```

有代理时：

```powershell
$env:HTTP_PROXY=''; $env:HTTPS_PROXY=''; $env:ALL_PROXY=''
npm run deploy
```

部署成功后终端会输出 Worker 地址，例如：

```
Published nav-item-worker (1.23 sec)
  https://nav-item-worker.你的子域.workers.dev
```

用浏览器打开该地址即可访问导航站，后台管理：**https://该地址/admin**，默认账号 **admin / 123456**。

**7. 自定义域名（可选）**

在 [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → 你的 Worker → Settings → Domains & Routes，添加你的域名即可。

### 源代码部署（传统 Node + SQLite）

#### 1. 克隆项目
```bash
git clone https://github.com/eooce/nav-Item.git
cd nav-item
```

#### 2. 安装后端依赖
```bash
npm install
```

#### 3. 构建前端
```bash
cd web && npm install && npm run build
```

#### 4. 启动后端服务
```bash
# 在项目根目录
cd .. && npm start
```

#### 6. 访问应用
- 前端地址：http://localhost:3000
- 后台管理：http://localhost:3000/admin
- 默认管理员账号：admin / 123456

### Docker 部署

#### 1：docker快速部署
   ```bash
   docker run -d \
     --name nav-item \
     -p 3000:3000 \
     -v $(pwd)/database:/app/database \
     -v $(pwd)/uploads:/app/uploads \
     -e NODE_ENV=production \
     -e ADMIN_USERNAME=admin \
     -e ADMIN_PASSWORD=123456 \
     eooce/nav-item
   ```
### 2: docker-compose.yaml 部署
```bash
version: '3'

services:
  nav-item:
    image: eooce/nav-item
    container_name: nav-item
    ports:
      - "3000:3000"
    environment:
      - PORT=3000             # 监听端口
      - ADMIN_USERNAME=admin  # 后台用户名
      - ADMIN_PASSWORD=123456 # 后台密码
    volumes:
      - ./database:/app/database  # 持久化数据库
    restart: unless-stopped
```
### 3: docker容器等使用docker image配合环境变量部署
```bash
eooce/nav-item
```
或
```bash
ghcr.io/eooce/nav-item:latest
```

## serv00|ct8|Hostuno 一键安装脚本
- 环境变量,放在脚本前，随脚本一起运行，英文空隔隔开
- 后台管理用户名和密码默认分别为为`admin`和`123456`
  * `DOMAIN`为自定义站点域名

```bash
bash <(curl -Ls https://github.com/eooce/nav-item/releases/download/ct8-and-serv00/install.sh) 
```

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👨‍💻 作者

**eooce** - [GitHub](https://github.com/eooce)

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！

---

⭐ 如果这个项目对你有帮助，请给它一个星标！ 






