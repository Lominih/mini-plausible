# Mini Plausible 项目介绍

> **Mini Plausible** 是一个轻量级、隐私优先的 Web 分析平台——可自托管的 Plausible Analytics 替代方案。

---

## 目录

- [一句话简介](#一句话简介)
- [项目背景](#项目背景)
- [核心功能](#核心功能)
- [技术架构](#技术架构)
- [数据模型](#数据模型)
- [SDK 介绍](#sdk-介绍)
- [API 概览](#api-概览)
- [安全特性](#安全特性)
- [部署指南](#部署指南)
- [开发指南](#开发指南)
- [项目结构](#项目结构)

---

## 一句话简介

Mini Plausible 是一个基于 Node.js 和 Express 构建的自托管 Web 分析引擎，通过无 Cookie、无 IP 追踪的方式收集页面浏览量和自定义事件，为站点所有者提供完整的隐私合规分析能力。

---

## 项目背景

在当今互联网生态中，网站分析几乎是每个站点运营者的刚需。然而主流分析平台（如 Google Analytics）通常需要在用户浏览器中植入大量追踪 Cookie、收集个人数据，这不仅带来了 GDPR、CCPA 等法规合规压力，也让用户隐私受到严重威胁。

Plausible Analytics 作为隐私优先分析领域的标杆产品，提供了一个优秀的替代方向，但其 SaaS 版本的订阅费用和闭源特性限制了部分用户的采用。Mini Plausible 由此诞生——它以 **Plausible 为灵感**，从零构建了一个**完全自托管、完全开源**的轻量分析平台，核心设计目标包括：

- **零个人数据收集**：不使用 Cookie 追踪身份、不存储 IP 地址，从架构层面杜绝隐私泄露
- **极致轻量**：客户端 SDK 压缩后不到 5 KB，对页面性能几乎零影响
- **完全自主可控**：所有数据存储在你自己的服务器上，支持 SQLite（开发）和 PostgreSQL（生产）
- **开箱即用**：通过 Docker Compose 一键部署，几分钟内即可开始收集分析数据

---

## 核心功能

### 1. 隐私优先的事件采集

Mini Plausible 的事件采集管线是整个系统的核心入口。它提供两个端点：

- **单事件采集** `POST /api/event`：接收单条分析事件
- **批量事件采集** `POST /api/events`：一次最多接收 100 条事件

采集端点**无需认证**（仅需 `x-site-id` 请求头），这保证了前端 SDK 可以零配置地发送数据。每条事件在入库前会经过以下处理流程：

1. **User-Agent 解析**：自动提取浏览器（Chrome、Firefox、Safari 等）和操作系统（Windows、macOS、Linux 等）信息
2. **UTM 参数提取**：从 URL 中自动解析 `utm_source`、`utm_medium`、`utm_campaign` 等营销追踪参数
3. **设备指纹**：基于 `localStorage` 生成持久化设备 ID（`mp_did`），用于去重和会话关联
4. **会话识别**：通过 `x-session-id` 请求头或 cookie 维护用户会话
5. **IP 哈希处理**：客户端 IP 仅用于地理定位查找（GeoIP），随后立即哈希化处理，原始 IP 不会被存储
6. **事件去重**：内置 30 秒去重窗口，基于 `deviceId + URL + sessionId` 组合键防止重复采集

### 2. 多维度分析查询

分析模块提供丰富的查询能力，支持以下维度的深度分析：

- **流量概览**：页面浏览量（Pageviews）、独立访客数（Visitors）、会话数（Sessions）、跳出率（Bounce Rate）、平均会话时长（Avg Duration）
- **时间序列**：支持按小时/天粒度的时间趋势图，可对比不同时间段
- **流量来源分析**：自动识别 Google、Bing、Twitter、Facebook 等主要引荐来源
- **设备与浏览器分析**：按浏览器类型、操作系统、设备类型（手机/平板/桌面）分组统计
- **地理分布**：按国家/地区维度统计访问分布
- **热门页面排行**：按访问量排序的页面排行

查询支持灵活的**时间段筛选**：

| 周期 | 说明 |
|------|------|
| `realtime` | 最近 5 分钟的实时数据 |
| `7d` | 最近 7 天 |
| `30d` | 最近 30 天（默认） |
| `90d` | 最近 90 天 |
| `custom` | 自定义日期范围（需提供 `date_from` 和 `date_to`） |

同时支持 `filters` 参数进行交叉筛选，以及 `compare=true` 进行前后周期对比分析。

### 3. 漏斗分析（Funnel Analysis）

漏斗分析是 Mini Plausible 的高级功能之一，用于追踪多步骤转化路径的转化率和流失率。

**漏斗步骤类型**：

- `page`：匹配特定页面 URL（支持模糊匹配）
- `event`：匹配特定自定义事件名称

**核心能力**：

- 支持 2-10 步的多步骤漏斗定义
- 计算每一步的用户数、转化率和流失率
- 计算步骤间的平均耗时
- 支持保存漏斗定义到数据库，后续可重复查询
- 提供整体转化率和完整转化时间统计（平均值、中位数、最小值、最大值）

**示例场景**：

```
首页访问 → 注册页面 → 填写表单 → 完成注册 → 首次购买
```

系统会精确追踪每个环节有多少用户流失，帮助运营者定位转化瓶颈。

### 4. 用户路径分析（User Paths）

用户路径分析模块可以可视化用户在网站中的浏览路径，帮助理解站点的导航结构和用户行为模式。

- 支持设置分析深度（1-10 层）
- 可配置返回路径节点数上限（1-200）
- 基于设备 ID 追踪单个用户的连续页面访问序列
- 自动分析路径分叉和汇聚模式

### 5. 每日数据聚合

为了保证查询性能，Mini Plausible 实现了**预计算聚合**机制。`AggregationService` 在后台周期性地将原始事件数据聚合为每日汇总指标：

**聚合指标**：

| 指标 | 说明 |
|------|------|
| `pageviews` | 页面浏览总数 |
| `visitors` | 独立访客数（基于设备 ID 去重） |
| `sessions` | 会话总数 |
| `bounceRate` | 跳出率（仅浏览一个页面的会话占比） |
| `avgDuration` | 平均会话时长（秒） |
| `topPages` | 热门页面 Top 10 |
| `topSources` | 热门来源 Top 10 |
| `countries` | 国家分布 Top 10 |
| `browsers` | 浏览器分布 Top 10 |
| `devices` | 设备分布 Top 5 |

聚合结果存储在 `DailyAggregate` 表中，查询时系统会自动判断是否可以使用聚合数据（时间范围较短时直接查询原始事件，范围较长时使用聚合数据），从而在查询速度和数据精度之间取得平衡。

### 6. 数据导出与自定义事件

**数据导出**：支持 JSON 和 CSV 两种格式的数据导出，包括站点信息、事件定义、原始事件、页面浏览、聚合统计和漏斗定义等全量数据。

**自定义事件**：除了默认的 `pageview` 事件外，用户可以追踪任意自定义事件，并携带自定义属性（`props`）。事件定义模块允许为每个站点注册事件名称及其属性 Schema，便于后续分析时的规范化查询。

---

## 技术架构

Mini Plausible 采用经典的三层架构设计：

```
┌─────────────────────────────────────────────────┐
│                   客户端 SDK                      │
│         (<5 KB, UMD + ESM 双格式输出)              │
│    事件队列 → 批量发送 → sendBeacon/XHR 回退       │
└──────────────────────┬──────────────────────────┘
                       │ HTTP POST
                       ▼
┌─────────────────────────────────────────────────┐
│                Express API 服务                   │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │   中间件层    │  │   路由层      │  │ 服务层   │ │
│  │ Helmet      │  │ /api/event   │  │ Pipeline│ │
│  │ CORS        │  │ /api/analytics│  │ Aggregr │ │
│  │ Rate Limit  │  │ /api/sites   │  │ Funnel  │ │
│  │ JWT Auth    │  │ /api/auth    │  │ Query   │ │
│  │ Compression │  │ /api/funnels │  │ Cache   │ │
│  │ Body Parse  │  │ /api/export  │  │ Paths   │ │
│  └─────────────┘  └──────────────┘  └─────────┘ │
└──────────────────────┬──────────────────────────┘
                       │ Prisma ORM
                       ▼
┌─────────────────────────────────────────────────┐
│                   数据库层                         │
│          SQLite (开发) / PostgreSQL (生产)          │
│     Prisma Schema → 自动生成类型安全的查询客户端     │
└─────────────────────────────────────────────────┘
```

### 技术栈详情

| 类别 | 技术选型 | 说明 |
|------|---------|------|
| 运行时 | Node.js 20+ | LTS 版本，保证长期支持 |
| Web 框架 | Express 5 | 成熟稳定的 HTTP 框架 |
| 语言 | TypeScript | 全栈类型安全 |
| ORM | Prisma 5 | 类型安全的数据库访问层 |
| 数据库 | SQLite / PostgreSQL | 开发用 SQLite，生产用 PostgreSQL |
| 认证 | JWT (jsonwebtoken) | 无状态 Token 认证 |
| 密码加密 | bcryptjs | 安全的密码哈希存储 |
| 数据校验 | Zod | 运行时类型验证和 Schema 定义 |
| 安全 | Helmet | HTTP 安全头设置 |
| 压缩 | compression | Gzip 响应压缩 |
| 日志 | Morgan | HTTP 请求日志 |
| 实时通信 | Socket.IO | 实时数据推送（可选） |
| 测试 | Vitest + Playwright | 单元测试 + 端到端测试 |
| SDK 打包 | Rollup | UMD + ESM 双格式输出 |
| 容器化 | Docker + Docker Compose | 生产级部署方案 |

---

## 数据模型

Mini Plausible 使用 Prisma 作为 ORM，定义了以下核心数据模型：

### User（用户）

系统的核心身份模型，所有站点和漏斗都归属于用户。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `email` | String (unique) | 登录邮箱 |
| `name` | String? | 用户昵称 |
| `password` | String | bcrypt 哈希密码 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

### Site（站点）

分析目标站点，每个站点有独立的域名和时区配置。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `name` | String | 站点名称 |
| `domain` | String | 站点域名 |
| `timezone` | String | 时区（默认 UTC） |
| `userId` | String | 所属用户（外键） |

### SiteMember（站点成员）

支持多用户协作的站点权限管理模型。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `siteId` | String | 站点 ID（外键） |
| `userId` | String | 用户 ID（外键） |
| `role` | String | 角色（默认 `viewer`） |

### Event（事件）

存储所有采集到的原始事件数据，是分析查询的核心数据源。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `siteId` | String | 站点 ID（索引） |
| `name` | String | 事件名称，如 `pageview`、`Signup` |
| `url` | String | 事件发生页面的 URL |
| `referrer` | String? | 引荐来源 URL |
| `screenWidth` / `screenHeight` | Int? | 屏幕分辨率 |
| `browser` | String? | 浏览器（自动解析） |
| `os` | String? | 操作系统（自动解析） |
| `country` / `city` | String? | 地理位置 |
| `utmSource` / `utmMedium` / `utmCampaign` | String? | UTM 营销参数 |
| `deviceId` | String? | 设备标识 |
| `sessionId` | String? | 会话标识 |
| `props` | String | 自定义属性（JSON 序列化） |
| `createdAt` | DateTime | 事件时间（索引） |

索引：`(siteId, createdAt)`、`(siteId, name)`

### DailyAggregate（每日聚合）

预计算的每日汇总数据，用于加速大时间范围的查询。

| 字段 | 类型 | 说明 |
|------|------|------|
| `siteId` + `date` | 唯一联合约束 | 保证每天每个站点只有一条聚合记录 |
| `pageviews` / `visitors` / `sessions` | Int | 核心计数指标 |
| `bounceRate` / `avgDuration` | Float | 效率指标 |
| `topPages` / `topSources` / `countries` / `browsers` / `devices` | String (JSON) | 排行数据（JSON 序列化） |

### Session（会话）

维护用户会话状态，用于计算会话时长和跳出率。

| 字段 | 类型 | 说明 |
|------|------|------|
| `deviceId` | String | 设备标识（索引） |
| `firstVisit` / `lastSeen` | DateTime | 会话起止时间 |
| `pagesViewed` | String (JSON) | 浏览页面列表 |
| `referrer` | String? | 会话来源 |

### 其他模型

- **EventDefinition**：事件定义注册表，存储站点自定义事件的名称和属性 Schema
- **Pageview**：独立的页面浏览记录表，支持更精细的页面分析和漏斗的 page 类型步骤匹配
- **Funnel**：漏斗定义存储，包含名称和步骤 JSON 配置

---

## SDK 介绍

Mini Plausible SDK 是一个专为隐私和性能设计的客户端追踪脚本，目标体积 **< 5 KB**（minified + gzipped）。

### 工作原理

#### 1. 初始化

SDK 通过 `<script>` 标签引入后立即执行 `init()` 函数，创建 `PlausibleTracker` 实例并绑定到全局 `window.plausible`（别名 `window.mp`）。

```html
<script
  defer
  data-domain="yourdomain.com"
  data-api-endpoint="https://analytics.example.com/api/event"
  src="https://analytics.example.com/tracker.js"
></script>
```

初始化时自动发送一个 `pageview` 事件。

#### 2. 事件采集

每条事件自动附带以下上下文信息：

| 字段 | 来源 | 说明 |
|------|------|------|
| `n` | 用户传入 | 事件名称 |
| `u` | `location.href` | 当前页面 URL |
| `d` | `localStorage` | 持久化设备 ID（`mp_did`） |
| `r` | `document.referrer` | 引荐来源 |
| `sw` / `sh` | `screen.width/height` | 屏幕分辨率 |
| `tp` | 屏幕宽度判断 | 设备类型（mobile/tablet/desktop） |
| `utm_*` | URL 参数 | UTM 营销追踪参数 |

#### 3. 事件队列与批量发送

SDK 内部维护一个事件队列（`EventQueue`），采用**批量发送策略**：

- **批大小**（`batchSize`）：默认 5 条事件
- **刷新间隔**（`batchInterval`）：默认 1000ms

工作流程：

```
事件入队 → 达到 batch size？ → 是 → 立即 flush
                 ↓ 否
           超过 interval？ → 是 → flush
                 ↓ 否
           等待下一条事件...
```

#### 4. 传输层

flush 时优先使用 **`navigator.sendBeacon`**（页面关闭时也能可靠发送），回退到 **XMLHttpRequest**。数据以 JSON 数组格式发送到采集端点。

#### 5. 自定义事件 API

```javascript
// 页面浏览（自动发送）
// 按钮点击
plausible('CTA Click', { props: { location: 'hero' } });

// 转化事件
plausible('Signup', { props: { plan: 'pro', source: 'organic' } });
plausible('Purchase', { props: { amount: 49.99, currency: 'USD' } });
```

### 构建与分发

SDK 使用 Rollup 打包，输出两种格式：

- **UMD**：通过 `<script>` 标签直接引入
- **ESM**：通过 `import` 用于现代构建工具链

```bash
cd sdk && npm install && npm run build
# 输出：sdk/dist/plausible.min.js
```

---

## API 概览

Mini Plausible 提供 RESTful API，以下按模块列出所有端点：

### 健康检查

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/health` | 否 | 服务健康状态 |

### 事件采集（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/event` | 单事件采集，需 `x-site-id` 头 |
| POST | `/api/events` | 批量事件采集（最多 100 条），需 `x-site-id` 头 |

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录，返回 JWT |

### 用户管理（需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 获取当前用户信息 |

### 站点管理（需认证 + 站点权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sites` | 获取站点列表 |
| POST | `/api/sites` | 创建站点 |
| GET | `/api/sites/:id` | 获取站点详情 |
| PUT | `/api/sites/:id` | 更新站点信息 |
| DELETE | `/api/sites/:id` | 删除站点 |

### 分析查询（需认证 + 站点权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/analytics?siteId=...&period=30d` | 获取站点分析数据 |
| 支持参数 | `period`, `date_from`, `date_to`, `filters`, `compare`, `limit`, `group_by` | 查询参数 |

### 漏斗分析（需认证 + 站点权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/analytics/funnels?siteId=...` | 获取漏斗列表或执行漏斗查询 |
| POST | `/api/analytics/funnels` | 创建并保存漏斗 |

### 用户路径（需认证 + 站点权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/analytics/paths?siteId=...` | 分析用户浏览路径 |

### 事件定义（需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/events/definitions` | 获取事件定义列表 |
| POST | `/api/events/definitions` | 注册新事件定义 |

### 数据导出（需认证 + 站点权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/:siteId?format=json` | 导出站点全量数据（JSON） |
| GET | `/api/export/:siteId?format=csv` | 导出站点全量数据（CSV） |

---

## 安全特性

Mini Plausible 在安全方面采用了多层防护机制：

### 认证与授权

- **JWT 认证**：使用 `jsonwebtoken` 签发有状态的访问令牌，默认 7 天有效期
- **密码哈希**：使用 `bcryptjs` 对密码进行单向哈希存储，防止明文泄露
- **站点权限控制**：通过 `SiteMember` 模型实现多用户协作，每个 API 请求都会验证用户对目标站点的访问权限
- **公开路由白名单**：事件采集和健康检查端点无需认证，降低前端集成门槛

### HTTP 安全

- **Helmet 中间件**：自动设置一系列 HTTP 安全头（X-Content-Type-Options、X-Frame-Options、Strict-Transport-Security 等）
- **CORS 配置**：允许跨域请求但限制允许的方法和头信息
- **请求体限制**：JSON body 限制为 10 KB，防止恶意大请求
- **Gzip 压缩**：启用响应压缩，提升传输效率的同时减少攻击面

### 速率限制

- **全局速率限制**（`globalLimiter`）：适用于所有请求
- **事件采集速率限制**（`eventLimiter`）：专门针对高频采集端点的限流
- **认证速率限制**（`authLimiter`）：针对登录/注册接口的暴力破解防护

### 隐私保护

- **无 Cookie 追踪**：不使用第三方 Cookie，设备 ID 仅存储在 `localStorage`
- **IP 不存储**：客户端 IP 仅在 GeoIP 查询时临时使用，随后立即哈希化，原始 IP 永不入库
- **数据最小化**：仅收集分析所需的最小数据集

### 数据库安全

- **Prisma ORM**：使用参数化查询，天然防御 SQL 注入
- **Zod 校验**：所有 API 输入都经过 Zod Schema 严格校验

---

## 部署指南

### 方式一：Docker Compose（推荐）

Docker Compose 提供最简单的生产级部署方式，包含应用服务和 PostgreSQL 数据库。

```bash
# 1. 克隆项目
git clone <repository-url>
cd mini-plausible

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 设置 JWT_SECRET 和 POSTGRES_PASSWORD

# 3. 构建并启动
docker compose up -d

# 4. 初始化数据库
docker compose exec app npx prisma db push

# 5. 填充示例数据（可选）
docker compose exec app npm run db:seed
```

**服务架构**：

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| `app` | mini-plausible-api | 3001 | API 服务，生产环境端口 |
| `db` | mini-plausible-db | 5432 | PostgreSQL 16 数据库 |

**Dockerfile 特点**：

- 多阶段构建（builder → production），减小最终镜像体积
- 使用 `dumb-init` 处理进程信号，确保容器优雅退出
- 以非 root 用户（`appuser:1001`）运行，符合安全最佳实践
- 内置 `HEALTHCHECK`，支持 Docker 健康监控

### 方式二：本地开发环境

```bash
# 1. 安装依赖
npm install

# 2. 生成 Prisma 客户端
npx prisma generate

# 3. 推送数据库 Schema（使用 SQLite）
npx prisma db push

# 4. 填充示例数据
npm run db:seed

# 5. 启动开发服务器
npm run dev
```

服务启动后访问 `http://localhost:3000`。

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接字符串 | `file:./dev.db` |
| `JWT_SECRET` | JWT 签名密钥 | 开发默认值（生产必须修改） |
| `PORT` | 服务监听端口 | `3000`（Docker 生产用 `3001`） |
| `NODE_ENV` | 运行环境 | `development` |

> **生产部署提醒**：务必修改 `JWT_SECRET` 为强随机字符串，否则存在令牌伪造风险。

---

## 开发指南

### 项目初始化

```bash
npm install              # 安装依赖
npx prisma generate      # 生成 Prisma 客户端
npx prisma db push       # 同步数据库 Schema
npm run db:seed          # 填充演示数据
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（ts-node） |
| `npm run build` | 编译 TypeScript → JavaScript |
| `npm start` | 运行生产构建 |
| `npm test` | 运行所有测试（Vitest） |
| `npm run test:watch` | 测试监听模式 |
| `npm run test:e2e` | 端到端测试（Playwright） |
| `npm run db:push` | 推送 Schema 到数据库 |
| `npm run db:seed` | 填充演示数据 |
| `npm run db:generate` | 重新生成 Prisma 客户端 |

### SDK 开发

```bash
cd sdk
npm install
npm run build    # 输出 dist/plausible.min.js
```

SDK 使用 Rollup 打包，支持 UMD 和 ESM 两种输出格式。

### 测试策略

- **单元测试**（Vitest）：覆盖服务层、工具函数、数据处理逻辑
- **端到端测试**（Playwright）：覆盖完整 API 请求链路
- **覆盖率**：使用 `@vitest/coverage-v8` 进行代码覆盖率统计

---

## 项目结构

```
mini-plausible/
├── src/                          # 服务端源码
│   ├── index.ts                  # 应用入口，路由注册与服务启动
│   ├── app.ts                    # Express 应用配置（中间件、安全头、压缩）
│   ├── middleware/
│   │   ├── auth.ts               # JWT 认证中间件、站点权限验证
│   │   └── rate-limit.ts         # 全局/事件/认证速率限制
│   ├── routes/
│   │   ├── analytics.ts          # 分析查询端点（时间序列、维度分析、对比）
│   │   ├── auth.ts               # 用户注册与登录
│   │   ├── collect.ts            # 事件采集端点（单条 + 批量）
│   │   ├── event-definitions.ts  # 事件定义注册与管理
│   │   ├── export.ts             # 数据导出（JSON / CSV）
│   │   ├── funnels.ts            # 漏斗 CRUD 与分析计算
│   │   ├── health.ts             # 健康检查
│   │   ├── paths.ts              # 用户路径分析
│   │   ├── sites.ts              # 站点 CRUD 管理
│   │   └── users.ts              # 用户信息管理
│   ├── services/
│   │   ├── aggregation.ts        # 每日数据聚合引擎
│   │   ├── cache.ts              # 查询结果缓存
│   │   ├── comparison.ts         # 周期对比计算
│   │   ├── embed.ts              # 嵌入脚本生成
│   │   ├── funnel.ts             # 漏斗计算引擎
│   │   ├── pipeline.ts           # 事件队列 + 批量入库 + 去重
│   │   ├── query-builder.ts      # 分析查询构造器
│   │   └── user-paths.ts         # 用户路径分析算法
│   ├── types/
│   │   ├── analytics.ts          # 分析相关类型定义
│   │   └── index.ts              # 通用类型定义（Zod Schema 等）
│   └── utils/
│       ├── ids.ts                # 设备 ID / 会话 ID / IP 哈希工具
│       ├── prisma.ts             # Prisma 客户端单例
│       ├── timeout.ts            # Promise 超时包装器
│       ├── user-agent.ts         # 浏览器 / 操作系统解析
│       ├── utm.ts                # UTM 参数提取
│       └── errors.ts             # 统一错误处理
├── sdk/                          # 客户端追踪 SDK
│   ├── src/
│   │   └── index.ts              # SDK 源码（PlausibleTracker 类）
│   ├── dist/                     # 打包输出
│   ├── package.json              # SDK 构建配置
│   ├── rollup.config.js          # Rollup 打包配置（UMD + ESM）
│   └── embed.html                # 嵌入演示页面
├── prisma/
│   ├── schema.prisma             # 数据库 Schema 定义
│   └── seed.ts                   # 演示数据填充脚本
├── Dockerfile                    # 多阶段生产构建
├── docker-compose.yml            # 应用 + PostgreSQL 服务编排
├── vitest.config.ts              # 测试配置
├── tsconfig.json                 # TypeScript 编译配置
├── package.json                  # 项目依赖与脚本
├── README.md                     # 项目说明文档
└── API.md                        # API 接口文档
```

---

## 附录：快速验证

部署完成后，可通过以下步骤验证系统工作正常：

```bash
# 1. 注册用户
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123","name":"Admin"}'

# 2. 登录获取 Token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' | jq -r .accessToken)

# 3. 创建站点
SITE_ID=$(curl -s -X POST http://localhost:3000/api/sites \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"My Site","domain":"example.com"}' | jq -r .id)

# 4. 发送测试事件
curl -X POST http://localhost:3000/api/event \
  -H "Content-Type: application/json" \
  -H "x-site-id: $SITE_ID" \
  -d '{"name":"pageview","url":"https://example.com/","screenWidth":1920}'

# 5. 查询分析数据
curl "http://localhost:3000/api/analytics?siteId=$SITE_ID&period=realtime" \
  -H "Authorization: Bearer $TOKEN"
```

---

> **Mini Plausible** — 让每一个网站都能拥有自己的隐私优先分析平台。🚀
