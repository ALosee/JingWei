# Jingwei 工程规范

本文件是本仓库内所有人工开发者与 AI Coding Agent 的强制规范。开始修改前必须阅读本文件；修改模块时还必须阅读该模块的 `README.md`、`src/manifest.ts`，涉及架构变更时阅读 `docs/adr/`。

## 1. 架构基线

- 项目是 pnpm Monorepo 中的 Modular Monolith。先保持严格模块边界，只有 ADR 证明存在独立扩容、故障域、安全域、团队或技术差异时才允许服务化。
- 固定技术栈：Vue 3、TypeScript、Vite、Vue Router、Pinia、Elegant Router；Node.js 24 LTS、Hono、`@hono/node-server`、`@hono/zod-openapi`；PostgreSQL 18、Kysely、`pg`；Zod；`@soybeanjs/fetch`、OpenAPI 3.1、Scalar；Vitest、Playwright；开发使用 `tsx`，服务端生产构建使用 `tsdown`。
- 未经 ADR 禁止引入 NestJS、Spring Boot、Prisma、TypeORM、Drizzle、Redis、Kafka、RabbitMQ、Elasticsearch、Kubernetes、微服务框架或 Decorator DI Container。
- 本阶段只建设 Platform Foundation。不得开发 CRM、销售、合同、项目、产品、采购、仓库、生产、财务、HR、资产、工作流、表单设计器、大屏设计器等具体业务。

## 2. 模块边界

- Module 是完整 Vertical Slice，依次包含 `shared`、`server/domain`、`server/application`、`server/infrastructure`、`server/public`、`server/api`、`client`、`web` 和模块自有 `migrations`。
- `system` 只能是前端菜单分类，不得成为代码模块。基础模块固定拆为 `iam`、`organization`、`navigation`、`dictionary`。
- package 必须使用显式 `exports`；禁止 `"./*": "./src/*"`。
- 跨 Module 只能引用对方公开 package export。禁止引用其他 Module 的 repository、infrastructure、database schema、内部 domain/application 实现，禁止相对路径穿越模块边界。
- 跨 Module 只能通过 Public API、Integration Event、Transactional Outbox 通信。需要立即结果时用 Public API；不要求同步结果时优先 Integration Event。
- Manifest 是纯 metadata，不读取数据库、环境变量，不安装运行时组件。Module 依赖图必须是 DAG；实际 package/module 依赖必须在 Manifest 的 required 或 optional dependencies 中声明。
- 禁止无归属的 `utils`、`helpers`、`common`、`misc` 垃圾桶；禁止万能 BaseEntity/BaseService/BaseRepository/BaseController。优先组合，不以继承减少少量重复。

## 3. 分层与依赖注入

- 后端依赖方向为 `API -> Application -> Domain <- Infrastructure`。
- Domain 不依赖 Hono、Kysely、PostgreSQL、HTTP、文件系统或其他技术适配器。
- Hono Route 必须 thin，只做 Zod validation、认证上下文、授权适配、调用 Application Use Case、response mapping。
- Transaction Boundary 位于 Application Use Case。Repository 不得自行决定业务事务；业务写入和重要 Outbox Event 必须在同一 PostgreSQL Transaction。
- V1 使用 Explicit Constructor/Factory Injection；Composition Root 位于 `apps/server/src/bootstrap/`。禁止 Service Locator、反射或 Decorator DI。
- 不强制简单 CRUD 使用复杂 Rich Domain Model；合同、库存、财务、生产、工作流等复杂领域才重点使用 Aggregate、Value Object、Domain Event。

### 3.1 入口、装配与功能实现（ADR 0008）

- 可执行入口（Web `main.ts`、Server `index.ts`、工具 CLI/seed/test runner）只导入并调用具名启动函数。入口不声明业务状态、分支、循环、回调流程，不直接请求接口、执行 SQL、处理导航/权限规则。
- App 的 `bootstrap/` 是 Composition Root：创建资源、选择实现、显式注入依赖并启动应用。它不承接从入口搬来的功能算法；导航加载/跳转策略归 Web 壳的 `navigation/`，HTTP 错误映射归 Server 的 `http/`，请求安全/日志归 `middleware/`。
- Module 的 `server/module.ts` 和 `public/create-*.ts` 只装配依赖、调用工厂，不内联 HTTP handler、业务用例或 SQL。API 调用 Application；Application/Domain 不反向依赖 API、Infrastructure 或装配文件。
- Vue `web/pages/*.vue` 负责展示、声明式绑定和组合。接口请求、跨步骤提交、失败处理等功能流程放入模块自有 composable/controller；可独立变化的编辑、版本发布、角色授权分别拥有状态，禁止形成万能 `usePage`/`useApp`。
- CLI 的 argv/env、退出状态和资源生命周期放在具名 `commands/` 函数；生成模板等纯规则与文件写入分离。具名命令实现允许承担其明确的运维用例，不是通用业务入口。
- 被导入的实现文件不得在顶层打开连接、启动监听/计时任务、修改全局路由或执行请求。资源由显式工厂创建，所有者负责失败清理与幂等释放。
- 不把所有 `index.ts` 当作进程入口：package 的导出入口、shared contract 和库实现按各自职责保留。按职责、状态所有权和可测试性拆分，不以固定行数或强制“一函数一文件”衡量质量。
- `pnpm architecture:check` 检查薄入口、装配层无 handler/SQL、服务端分层方向、页面不直连 client、模块不读取 process.env；规则不能替代语义 review。新入口/编码形式必须同步更新检查与测试，禁止通过改名、动态导入或无归属包装层绕过。

## 4. 数据库规则

- 使用一个 PostgreSQL Database，每个 Module 拥有独立 PostgreSQL Schema；每张表必须有唯一 Owner Module。
- 模块内允许 Foreign Key；跨 Module 禁止 Foreign Key、直接 SQL、跨 Schema DDL。跨模块只保存 UUID，通过 Application/Public API/Event 保证一致性。
- 所有普通业务请求必须携带 `ApplicationContext { requestId, tenantId, userId }`。私有化部署也创建 Default Tenant；禁止 `singleTenantMode` 绕过 `tenant_id`。V1 使用应用层租户隔离，不启用 RLS。
- 核心实体使用 UUID v7；时间使用 `timestamptz` 并以 UTC 处理；纯业务日期用 `date`。
- 金额/价格/数量使用合适精度的 `numeric`；API 金额用字符串；禁止 JavaScript `number` 做财务金额运算。
- 不建立全局 soft delete。重要业务单据用明确状态行为（作废、撤销、冲销等）；重要 Root Entity 预留 `version` 乐观锁。
- JSONB 只用于设计器 Schema、配置扩展、外部原始 payload、审计 diff 等适合动态结构的场景，不得替代正常业务列。
- Migration 属于 Owner Module，使用全局唯一 `YYYYMMDDHHmmss_module_description.ts` 命名。生产 Migration Registry 由 Edition Builder 静态生成；不得动态扫描源码。停用 Module 绝不自动 DROP Schema/Table。

## 5. 身份与授权

- `User != Employee`。IAM 只管理 User、Credential、Role、Permission、User Role、Data Scope、Authentication/Authorization；Employee 属于未来 HR Module。
- Web 认证采用 Server-side Session + HttpOnly Cookie。Cookie 保存 CSPRNG opaque token，数据库只保存 token hash；支持 idle/absolute expiry、logout、revoke、禁用用户和改密后的全部 revoke。
- 密码统一 Argon2id。Cookie Authentication 必须执行 Origin Validation 与 CSRF Protection。禁止以复杂 Access/Refresh JWT 体系替换本基线。
- 功能 Permission Source of Truth 是 Module Manifest；数据库 permission definition 只是运行时 projection。命名统一 `<module>.<action>`。Navigation 授权另按稳定节点 code 分配给 Role，不授予功能 API 权限（ADR 0007）。
- V1 为 `User -> Role -> Permission` 的 Allow-only RBAC；禁止直接给 User 授 Permission，禁止 Explicit Deny；多个角色权限和数据范围取并集。
- 功能 Permission 与 Data Scope 分离。数据范围固定为 `ALL | ORGANIZATION | ORGANIZATION_AND_DESCENDANTS | SELF | CUSTOM`。
- 授权顺序固定为 `Edition -> Module -> Capability -> Permission -> Data Scope`。菜单和前端按钮只改善 UX，不是安全边界。

## 6. 动态导航与 Elegant Router

- Route Definition、Navigation、Permission、Vue Component 是四个独立概念；禁止 `Menu = Route = Permission`。
- Module 代码提供稳定 `routeKey` 与安全声明；Tenant Navigation 编排 name、icon、parent、sort、path、layout、默认 params/query 和合法范围内的 access mode。数据库只引用 `routeKey`，禁止保存 Vue 源码路径。layout 必须在 Route Definition 的 allowedLayouts 内（省略时仅允许默认 layout）。
- Route Access Mode 固定为 `PUBLIC | AUTHENTICATED | PERMISSION`。每个 Route Definition 必须声明 `allowedAccessModes`；动态配置不得将受保护页面降级为 PUBLIC。
- Navigation Node 使用统一版本化表，支持 `DIRECTORY | GROUP | MENU | PAGE | EXTERNAL_LINK`（ADR 0007），不另建 Route 表。PERMISSION 根据 Role 获授的 navigation code 判断，外链不需要 routeKey；容器由可见子项推导。外链默认仅允许 HTTPS，禁止 `javascript:`、`data:`。
- App 启动先加载 Edition Page Registry，再请求无需登录的 `GET /api/v1/navigation/bootstrap`；登录后请求 `GET /api/v1/navigation/me`，最后通过 `router.addRoute()` 挂载。必须保留极小 Static Recovery Layer。
- Navigation 配置采用 Draft -> Validate -> Publish，草稿属于 Version，Publish 将其冻结并切换发布指针，保留历史快照供 Rollback。至少校验模块、Route、Capability、Permission、Access Mode/Layout 范围、路径冲突、循环、外链和认证入口。
- Elegant Router 只负责 Build-time Page Discovery / Component Registry Generator。它不拥有 Runtime Navigation、Permission、Tenant Menu、Edition、最终 URL 或业务 Route Identity。
- Edition Builder 必须限制 Elegant Router 的 `pageDir`；未启用模块的页面、component import 和 chunk 不得进入最终 bundle。Generated 文件禁止人工修改。

## 7. API、类型与错误

- 所有外部 body/query/params 必须使用 Zod Runtime Validation。TypeScript 类型不能替代运行时校验。
- 共享的是 API Schema/Contract，不是 Database Row 或可变 Domain Entity。
- API contract 由 Module 自有的 Zod OpenAPI route 定义；使用 `openapi-typescript` 生成 Module 自有 `paths`，再通过 `@soybeanjs/fetch/openapi` 建立 module-scoped typed client。禁止覆盖整个平台的 Mega AppType，禁止把生成类型当作运行时验证。
- 交互式 HTTP 操作默认使用 Soybean Fetch 扁平客户端并返回 `{ data, error }`；只有应用启动等明确 fail-fast 的流程才使用显式 throwing client。请求 loading 必须由 Fetch lifecycle callback 经共享 Vue 状态适配器驱动，禁止在页面或业务 composable 中围绕 HTTP Promise 手工切换 loading。
- API 使用 `/api/v1/...`；业务动作允许明确的 action endpoint。
- 对外错误统一包含稳定 `code`、安全 `message`、`requestId` 和可选 `details`。禁止返回 stack、SQL/driver error 或内部异常。
- strict TypeScript 必须开启。禁止以 `any`、`@ts-ignore`、`eslint-disable`、`as unknown as` 逃避类型系统；确有第三方边界例外时需最小范围并说明理由。

## 8. 日志、审计、测试与依赖

- 日志必须结构化，关键上下文包含 `requestId`、`tenantId`、`userId`、`module`、`action`；禁止记录密码、token、secret、API key 或完整敏感信息。
- 安全、权限、审批、作废、财务、库存和关键配置操作必须审计。Audit Log append-only。
- Bug fix 先增加可复现测试；复杂 Domain/Application 规则必须测试；Repository/API 用集成测试；关键路径使用 Playwright。不要追求无意义 100% coverage。
- 新 dependency 必须证明标准库和现有依赖不能合理完成、维护状态可接受、长期成本值得。不得为几十行简单代码增加依赖。
- ESLint 负责代码质量，Oxfmt 负责格式化和导入排序。保留严格 TypeScript 与 Vue 质量检查，不启用与 Oxfmt 冲突的排版规则。格式和排序以根 `.oxfmtrc.json` 为准；副作用导入保留顺序，生成文件、锁文件和构建/测试产物不手动格式化。
- 客户差异只能通过 Edition、Module、Capability、Config 表达；禁止散落 `if (customerId === ...)`。
- 改动只覆盖必要范围；发现旁支问题记录，而不是顺手重写无关模块。

## 9. 完成定义

提交前必须运行并通过：

```text
pnpm typecheck
pnpm lint
pnpm format:check
pnpm api:check
pnpm architecture:check
pnpm test
pnpm build
```

功能只有在实现、权限/数据范围/租户边界、Migration、Error Code、必要日志/审计、测试、文档与模块边界均处理完成后才算完成。

优先级：**架构一致性 > 模块边界 > 正确性 > 可维护性 > 测试 > 局部开发速度 > 少写几行代码**。

## 10. Git 提交与推送

- 本仓库提交与推送统一使用邮箱 `1749035947@qq.com`，提交的 Author 和 Committer 邮箱都必须一致。通过仓库级 `git config --local user.email` 设置，不修改其他仓库或全局身份；推送前核对提交身份。
- 不提交真实环境文件、密码、Token、私钥、数据库备份、依赖目录或构建/测试产物；只保留不含真实凭据的环境示例。提交说明应写清目的、主要变更、验证结果和当前实现边界。
