# Mini Plausible

一款轻量级、隐私优先的 Web 分析平台——可自托管的 Plausible Analytics 替代方案。

## 概述

Mini Plausible 以无 Cookie、无 IP 追踪、不收集个人数据的方式追踪页面浏览和自定义事件。整个分析管线运行在你自己的基础设施上，让你完全掌控访客数据。

## 功能特性

- **隐私优先**：无 Cookie、无 IP 追踪，默认符合 GDPR/CCPA
- **轻量级 SDK**：压缩后不到 5KB 的客户端追踪脚本
- **事件批处理**：高效的批量事件投递，减少网络开销
- **UTM 追踪**：自动提取 UTM 营销活动参数
- **设备检测**：通过 User Agent 识别浏览器、操作系统和设备类型
- **会话追踪**：访客会话管理，包含跳出率和停留时长指标
- **漏斗分析**：多步骤转化漏斗，附带流失率
- **实时分析**：实时访客计数和页面浏览流
- **每日聚合**：预计算的日聚合数据，加速查询
- **自定义事件**：支持任意属性的事件追踪
- **JWT 认证**：基于令牌的安全 API 访问
- **Docker 就绪**：通过 Docker Compose 一键部署
- **SQLite + PostgreSQL**：开发环境使用 SQLite，生产环境使用 PostgreSQL

## 快速开始

### 环境要求

- Node.js 20+
- npm

### 本地开发

```bash
# 安装依赖
npm install

# 生成 Prisma Client
npx prisma generate

# 推送数据库 Schema
npx prisma db push

# 初始化演示数据
npm run db:seed

# 启动开发服务器
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

### Docker 部署

```bash
# 构建并启动所有服务
docker compose up -d

# 运行数据库迁移
docker compose exec app npx prisma db push

# 初始化演示数据
docker compose exec app npm run db:seed
```

## API 文档

### 认证

大部分端点需要 JWT 令牌。通过认证端点获取：

```bash
# 注册
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123","name":"Admin"}'

# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

### 采集事件

```bash
# 单事件采集
curl -X POST http://localhost:3000/api/event \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "your-site-id",
    "name": "pageview",
    "url": "https://example.com/",
    "referrer": "",
    "browser": "Chrome",
    "os": "Windows",
    "screen_width": 1920
  }'
```

### 分析查询

```bash
# 获取站点分析数据
curl http://localhost:3000/api/analytics/SITE_ID?period=30d \
  -H "Authorization: Bearer YOUR_TOKEN"

# 可用周期：realtime、7d、30d、90d、custom
```

### 漏斗分析

```bash
# 创建并查询漏斗
curl -X POST http://localhost:3000/api/analytics/funnels \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "your-site-id",
    "name": "注册漏斗",
    "steps": [
      {"type": "page", "value": "/"},
      {"type": "event", "value": "Signup"},
      {"type": "event", "value": "Purchase"}
    ]
  }'
```

## SDK 集成

### Script 标签（推荐）

```html
<script
  defer
  data-domain="yourdomain.com"
  data-api-endpoint="https://analytics.example.com/api/event"
  src="https://analytics.example.com/tracker.js"
></script>
```

### 自定义事件

```javascript
plausible('Signup', { props: { plan: 'pro' } });
plausible('Purchase', { props: { amount: 49.99, currency: 'USD' } });
```

### Node.js / npm

```bash
cd sdk && npm install && npm run build
```

构建产物 `sdk/dist/plausible.min.js` 可从你自己的域名托管。

## 项目结构

```
mini-plausible/
├── src/
│   ├── index.ts              # 服务端入口
│   ├── app.ts                # Express 应用配置
│   ├── middleware/
│   │   ├── auth.ts           # JWT 认证中间件
│   ├── routes/
│   │   ├── analytics.ts      # 分析查询端点
│   │   ├── auth.ts           # 注册 / 登录
│   │   ├── collect.ts        # 事件采集
│   │   ├── funnels.ts        # 漏斗 CRUD + 分析
│   │   ├── sites.ts          # 站点管理
│   │   └── ...
│   ├── services/
│   │   ├── pipeline.ts       # 事件队列 + 批量插入
│   │   ├── aggregation.ts    # 每日聚合计算
│   │   ├── funnel.ts         # 漏斗计算引擎
│   │   ├── query-builder.ts  # 分析查询构建
│   │   ├── embed.ts          # 嵌入脚本生成
│   │   └── ...
│   └── utils/
│       ├── user-agent.ts     # 浏览器 / 操作系统检测
│       ├── utm.ts            # UTM 参数提取
│       └── prisma.ts         # Prisma Client 单例
├── sdk/
│   ├── src/index.ts          # 客户端追踪 SDK
│   ├── package.json          # SDK 构建配置
│   ├── rollup.config.js      # 打包配置（UMD + ESM）
│   └── embed.html            # 嵌入演示页面
├── prisma/
│   └── schema.prisma         # 数据库 Schema
├── Dockerfile                # 多阶段生产构建
├── docker-compose.yml        # 应用 + PostgreSQL 服务
├── vitest.config.ts          # 测试配置
└── package.json
```

## 测试

```bash
# 运行所有测试
npm test

# 监听模式运行测试
npm run test:watch

# 运行端到端测试
npm run test:e2e
```

## 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接字符串 | `file:./dev.db` |
| `JWT_SECRET` | JWT 签名密钥 | 开发回退值 |
| `PORT` | 服务端口 | `3000` |
| `NODE_ENV` | 运行环境 | `development` |

完整模板请查看 `.env.example`。

## 许可证

MIT
