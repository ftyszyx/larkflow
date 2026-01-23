# server

## 环境安装

install deno
```
npm install -g deno
```


init project
```
deno init --npm hono --template=deno my-app
```


```
deno task start
```

install drizzle-orm
```
deno install npm:drizzle-orm npm:drizzle-kit npm:pg npm:@types/pg
```


### migrate 流程（推荐）
在drizzle目录下定义.sql
然后直接执行migration
### 先生成一个sql
```
deno -A --node-modules-dir npm:drizzle-kit generate --custom --name=init
```
### 执行migration
```
deno -A --node-modules-dir npm:drizzle-kit migrate
```

### 使用pull更新schema
```
deno -A --node-modules-dir npm:drizzle-kit pull
```



### 官方推荐流程（难以理解）

先定义schema.ts

### 直接覆盖数据库
```
deno -A --node-modules-dir npm:drizzle-kit push
```

### 从数据库同步到schema
```
deno -A --node-modules-dir npm:drizzle-kit pull
```

### 通过migration写入数据库
通过drizzle-kit生成migration
```
<!-- deno task db:generate -->
deno -A --node-modules-dir npm:drizzle-kit generate
```

### 执行migration
```
deno -A --node-modules-dir npm:drizzle-kit migrate
```


## 实现方案

### 1. 项目结构

建议按“路由/服务/数据访问”分层：

- **`main.ts`**：创建 Hono app，注册中间件、路由、启动服务
- **`routes/`**：HTTP 路由（仅做参数校验 + 调 service）
- **`services/`**：业务逻辑（文章同步、发布流程、任务调度等）
- **`drizzle/`**：数据库 schema、relations、迁移 SQL
- **`db/`**：数据库连接与 drizzle client 初始化
- **`jobs/`**：队列/定时任务的执行器（从 jobs 表取任务、锁定、执行、写回状态）

### 2. 数据库与迁移

- **迁移**：优先使用 `drizzle/*.sql` + `drizzle-kit migrate`
- **schema**：
  - 推荐维护一份“手写的权威 schema”（例如 `db/schema.ts`）
  - `drizzle/schema.ts` 如果来自 `pull`，建议视为“可再生文件”，必要时手动修正或升级 drizzle-kit

### 3. 基础能力（必须先打通）

- **数据库连接**：读取 `DATABASE_URL`，初始化 `pg` + drizzle
- **健康检查**：`GET /healthz` 返回版本/时间/DB 连通性
- **统一错误处理**：输出结构化错误（message/code/details）

### 4. 核心数据与接口（按模块推进）

#### 4.1 articles（文章）

- **写入/更新**：
  - `POST /articles` 新建
  - `PATCH /articles/:id` 更新 title/summary/content/status
- **查询**：
  - `GET /articles` 列表（分页、按 status、按 updatedAt 排序）
  - `GET /articles/:id` 详情（可带 sources/assets/publish_jobs）

#### 4.2 article_sources（来源）

- **绑定来源**：`POST /articles/:id/sources`（source/sourceDocToken/sourceUpdatedAt）
- **幂等**：利用 `uq_article_sources_source_doc` 做 upsert

#### 4.3 assets（资源）

- **登记资源**：`POST /articles/:id/assets`
- **去重**：sha256 唯一索引，避免重复入库

#### 4.4 publish_jobs（发布任务）

- **创建发布任务**：`POST /articles/:id/publish`（platform + payload）
- **状态机**：queued -> running -> success/failed

### 5. 后台任务（jobs 表）

- **Worker 进程**：循环拉取 `jobs` 表中到期任务
- **分布式锁**：通过 `locked_by` + `locked_until` 实现抢占/续期
- **失败重试**：基于 `attempts/max_attempts` + 指数退避（可后续加）
- **任务类型**：
  - sync：同步来源到 articles/content
  - publish：把文章发布到指定平台并回写 publish_jobs

### 6. 权限与配置（按需）

- **鉴权**：先用简单 API Key（Header）或 JWT（二选一）
- **配置管理**：`.env` + `Deno.env.get`，避免硬编码

### 7. 运行与联调

- **本地启动**：`deno task start`
- **迁移**：`deno -A --node-modules-dir npm:drizzle-kit migrate`
- **接口调试**：Postman/Bruno 或 curl
