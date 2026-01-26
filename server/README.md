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

## 实现方案

### 1. 项目结构

建议按“路由/服务/数据访问”分层：

- **`main.ts`**：创建 Hono app，注册中间件、路由、启动服务
- **`routes/`**：HTTP 路由（仅做参数校验 + 调 service）
- **`services/`**：业务逻辑（文章同步、发布流程、任务调度等）
- **`drizzle/`**：数据库 schema、relations、迁移 SQL
- **`db/`**：数据库连接与 drizzle client 初始化
- **`jobs/`**：队列/定时任务的执行器（从 jobs 表取任务、锁定、执行、写回状态）

### 2. 接口实现步骤（按里程碑）

#### 2.1 里程碑 0：基础工程与约定

- **统一返回结构**：成功与失败的 JSON 结构、错误码（400/401/403/404/500）
- **统一日志**：请求日志 + service 内关键日志（便于排错）
- **环境变量**：`DATABASE_URL`、（可选）`API_KEY`、（可选）第三方平台的密钥配置

#### 2.2 里程碑 1：鉴权与多租户上下文

- **鉴权方式**（先简单后完善）：
  - 方案 A：Header `X-Api-Key`（最简单）
  - 方案 B：JWT（后续再加）
- **租户上下文**：每个请求解析出 `workspaceId`（例如 Header `X-Workspace-Id` / 子域名 / 路由参数，选一种即可）
- **RBAC**：基于 `workspace_members` 的 `role` 做权限判断
  - `owner/admin`：可管理集成
  - `member`：可编辑文章
  - `viewer`：只读

#### 2.3 里程碑 2：基础数据接口（users/workspaces/members）

- **users**：
  - `GET /me`（返回当前用户信息）
- **workspaces**：
  - `GET /workspaces`（用户加入的工作空间列表）
  - `POST /workspaces`（创建 workspace，创建者默认 owner）
- **workspace_members**：
  - `GET /workspaces/:id/members`
  - `POST /workspaces/:id/members`（owner/admin 执行）
  - `PATCH /workspaces/:id/members/:userId`（改 role，owner/admin）

#### 2.4 里程碑 3：集成管理接口（integrations）

目标：让 owner/admin 能绑定飞书/公众号等平台账号。

- `GET /integrations`（当前 workspace 下的集成列表）
- `POST /integrations`（创建集成：`platform_type` + `name` + `feishu_workspace_id` + token 等）
- `PATCH /integrations/:id`（更新 config/token/status 等）
- `DELETE /integrations/:id`

约定：普通 member 调 `GET /integrations` 时不返回敏感字段（token 等）。

#### 2.4.1 同步飞书空间文档（feishu_space_syncs + jobs）

目标：把“同步飞书文档（单篇）”做成异步任务，并且可观测（有状态、有错误）。

数据落点：

- `feishu_space_syncs`：每个 `(integration_id, doc_token)` 一条“同步当前态”（`status/last_synced_at/last_error`）
- `jobs`：同步任务队列（worker 拉取执行）
- `articles`：最终落库的文章（按 `(integration_id, source_doc_token)` 幂等 upsert）

接口建议：

- `POST /integrations/:id/sync`
  - 作用：触发一次“同步该 integration 下某篇飞书文档”的任务
  - RBAC：`owner/admin`（可选：`member` 也可触发，只要是 workspace 成员）
  - 行为：
    - upsert `feishu_space_syncs`（若不存在则创建；若 `status=syncing` 可直接返回）
    - 创建 `jobs` 记录（`queue=sync_feishu_space`）
  - jobs.payload 示例：
    - `{ "type": "sync_feishu_space", "integrationId": 1, "workspaceId": 1, "docToken": "doccnxxxx" }`

- `GET /integrations/:id/sync`
  - 作用：查看同步状态
  - 入参：`docToken`（query）
  - 返回：`feishu_space_syncs` 当前态（`status/last_synced_at/last_error/updated_at`）

- `POST /integrations/:id/sync/reset`
  - 作用：重置该 docToken 的同步状态
  - RBAC：`owner/admin`
  - 行为：把 `status` 置为 `idle`，清空 `last_error/last_synced_at`

worker 执行逻辑（`jobs` -> `sync_feishu_space` handler）：

- **抢占**：用 `jobs.locked_by/locked_until` 抢到任务
- **置状态**：把 `feishu_space_syncs.status` 更新为 `syncing`
- **拉取文档内容**：
  - 从 `jobs.payload.docToken` 获取要同步的文档 token
  - 调飞书接口拉文档 blocks/内容并转换为 Markdown
- **写入 articles（幂等）**：
  - 对每个文档，用 `(integration_id, source_doc_token)` 做 upsert
  - `source_updated_at` 写飞书侧更新时间
  - `content_md/content_md_final` 写转换后的内容（或先写空，后续再做转换任务）
- **成功收尾**：
  - 更新 `last_synced_at`，清空 `last_error`，`status=idle`
- **失败处理**：
  - `feishu_space_syncs.status=failed`，写 `last_error`
  - `jobs.attempts++`，按 `max_attempts` 决定是否重试（可指数退避）

#### 2.5 里程碑 4：文章接口（articles）

目标：对外提供文章列表/详情/更新，并支持“按飞书 docToken 幂等 upsert”。

- `GET /articles`（分页、按 `status` 过滤、按 `updated_at` 排序）
- `GET /articles/:id`
- `POST /articles`（手动创建，或用于同步落库）
- `PATCH /articles/:id`（更新 `title/content_md/content_md_final/status/cover_url`）

同步幂等策略：通过 `uq_articles_integration_doc (integration_id, source_doc_token)` 做 upsert。

#### 2.6 里程碑 5：附件接口（assets）

- `GET /articles/:id/assets`
- `POST /articles/:id/assets`（登记附件：`type`=image/file、`oss_*` 等）

#### 2.7 里程碑 6：发布接口（article_publications + jobs）

目标：发布走异步任务，前端只看“当前态”。

- `POST /articles/:id/publish`：创建一条 `jobs` 任务（payload 包含 `articleId/integrationId/platform_type`）
- `GET /articles/:id/publications`：返回该文章在各平台的发布状态（读 `article_publications`）

worker 执行完成后写回：
- 更新/插入 `article_publications`（status/remote_id/remote_url/published_at/updated_at）

#### 2.8 里程碑 7：后台 worker（jobs 表轮询）

- **取任务**：按 `scheduled_at` 拉取、用 `locked_by/locked_until` 抢占
- **执行**：按 `queue` 或 `payload.type` 分发到不同 handler（sync/publish）
- **失败重试**：基于 `attempts/max_attempts`
- **可观测性**：任务执行日志 +（可选）把关键结果写回 `jobs.payload` 或新增 `jobs.result`

#### 2.9 里程碑 8：联调与回归

- **用例**：
  - 创建 workspace -> 绑定飞书 integration -> 同步一篇文章 -> 发布到目标平台
- **检查点**：
  - RBAC 是否生效
  - 幂等同步是否会重复插入
  - 失败是否能重试、状态是否能落到 `article_publications`


## test
deno task test
