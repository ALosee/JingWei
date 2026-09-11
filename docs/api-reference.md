# 公共 TypeScript API 参考

本文解释跨包可使用的关键 API、它们的边界和常见误用。完整签名以各包 `src/index.ts` 导出为准；业务模块只能从另一个模块的 `public` 入口或事件契约访问它，不能导入其内部目录。

## 1. API 稳定性分层

| 入口                       | 使用者         | 稳定性要求                           |
| -------------------------- | -------------- | ------------------------------------ |
| `@jingwei/*` 平台包根导出  | 所有应用和模块 | 平台公共契约，修改需评估全仓库影响   |
| `@jingwei/module-*/public` | 其他业务模块   | 模块公开同步契约，必须保持最小化     |
| Integration Event 类型     | 异步消费者     | 需要版本与兼容性策略                 |
| 模块内部文件               | 模块自身       | 不承诺跨模块兼容，禁止被外部深层导入 |
| `apps/*` 内部入口          | 组合根         | 不作为复用库发布                     |

## 2. `@jingwei/kernel`

### `ApplicationContext`

一次应用操作的上下文，承载请求关联信息、认证身份和平台级元数据。它应从 HTTP、任务或测试边界创建，然后显式传给用例。

关键规则：

- 不使用全局变量保存当前租户或用户；
- 后台任务也要建立明确的系统上下文；
- `requestId` 应贯穿日志、审计和错误响应；
- 未认证上下文不能伪造用户标识。

### `ApplicationError`、`DomainError`

- `DomainError` 表达领域规则被拒绝，例如非法状态转换；
- `ApplicationError` 表达应用边界可识别的失败，并携带稳定 code、HTTP 状态和安全 details；
- 未知基础设施异常应在最外层记录完整原因，再返回通用错误，不能把 SQL 或堆栈暴露给客户端。

### 强类型 ID

`createId`/各实体 ID 工厂生成带品牌的 UUIDv7 字符串类型。品牌类型用于阻止把 `UserId` 误传为 `TenantId`，但运行时仍需在外部输入边界解析与验证。

### `Clock`

业务时间通过 `Clock` 注入。生产使用 `systemClock`，测试使用固定时钟，避免在领域和用例中散落 `new Date()`。

## 3. `@jingwei/module-sdk`

这是 Edition 和 Module 组合机制的核心。完整概念见 [Edition 与 Module 手册](./edition-module-handbook.md)。

### `defineModule(manifest)`

声明模块的静态元数据，同时执行结构校验。返回值保留字面量类型，便于构建器和注册表推导 module id。

```ts
export const manifest = defineModule({
  id: 'organization',
  name: '组织与岗位',
  category: 'foundation',
  dependencies: ['iam'],
  optionalDependencies: [],
  capabilities: [{ id: 'organization.core', name: '组织与岗位基础' }],
  permissions: [{ code: 'organization.view', name: '查看组织', supportsDataScope: false }],
  routeDefinitions: [],
})
```

约束：id 稳定且全局唯一；依赖必须明确；capability 表达产品能力，permission 表达授权动作，两者不能因为名称接近就混为一谈。

### `defineEdition(definition)`

声明产品 Edition 的根模块集合和显式配置。它只描述产品选择，不负责读取文件系统或实例化模块。

### `resolveEdition(edition, manifests)`

计算 Edition 的依赖闭包并返回稳定拓扑顺序。如果 manifest 缺失、出现循环依赖或 Edition 引用了未知模块，应立即失败。这个失败发生在生成/启动阶段，而不是等到用户访问某个页面。

### `ModuleRegistry`

运行时模块目录，保存已经验证并按依赖顺序排列的 manifest。常用于能力判断、诊断和导航过滤。注册表不是依赖注入容器，也不应保存请求级可变状态。

### `ServerModule`

服务端模块接入契约：

```ts
interface ServerModule {
  readonly manifest: ModuleManifest
  install(context: ServerModuleContext): Promise<InstalledServerModule>
}
```

`install` 装配模块自己的仓储、用例和 Hono 子应用，返回 `id`、`basePath`、`routes` 与可选的 `dispose`。模块不得监听端口、关闭共享数据库池，也不得在导入文件时产生连接数据库等副作用。

### `WebModule` 与 `PageBinding`

Web 模块把 manifest route key 绑定到构建生成的 page key；URL 路径属于 Navigation。数据库选择 `base`（标准工作区）或 `blank`（页面完全控制结构）；Manifest.layout 是默认值，allowedLayouts 限制配置范围，省略时只允许默认布局。页面绑定是构建期可分析的数据，不携带运行时用户状态。可见性由 Edition、能力、访问模式和角色 navigation code grants 决定，功能 API Permission 另外判断。

## 4. `@jingwei/config`

### `loadConfig(environment)`

从环境变量读取、解析并验证配置，返回不可变的 `AppConfig`。调用方应在组合根启动时执行一次并快速失败，不要让业务模块直接读取 `process.env`。

当前配置包括运行环境、监听地址、数据库连接、Web Origin、匿名启动租户 BOOTSTRAP_TENANT_CODE 和会话 idle/absolute 有效期。Edition 由构建命令选择，不从运行时配置读取。敏感配置不得打印完整值。

## 5. `@jingwei/database`

### `DatabaseRuntime`

持有平台数据库池，并按调用方数据库类型提供 Kysely 视图。连接的创建和关闭属于应用组合根；业务模块不得自行新建全局连接池。租户目录是独立端口，由组合根基于该运行时创建。

### `TenantDirectory`

当前提供 `findActiveByCode(code)`，从平台租户表返回活动租户快照，供登录边界把 tenant code 转为可信 `TenantId`。接口隔离表结构，也为未来扩展租户数据路由保留边界。

### `TransactionRunner.execute(work)`

在一个数据库事务中执行回调：成功则提交，抛错则回滚，并始终释放连接。需要同时写业务数据、审计和 outbox 的操作应共享同一事务连接，保证原子性。

### `StaticMigrationProvider`

保存由模块提供的迁移映射。迁移 CLI 通过它按 Edition 收集迁移；运行时请求不应动态执行 DDL。

## 6. `@jingwei/auth`

### `PasswordHasher`

抽象密码摘要算法。默认实现为 `Argon2idPasswordHasher`。业务代码只调用 `hash` 和 `verify`，不能自行拼接盐值或比较摘要字符串。

### `SessionService`

负责会话创建、解析、过期和撤销的应用服务。调用方传入原始令牌时，服务只用恒定策略生成摘要后查询仓储；原始令牌只存在于必要的边界内。

IAM 的 `getSessionStatus()` typed client 使用一个允许匿名的 `200` 状态接口恢复 HttpOnly-cookie 会话。确认 `authenticated: true` 后，Web 才请求受保护的用户导航。

### `SessionRepository`

会话持久化端口。实现只接收令牌摘要，并在活动查询中同时检查 idle/absolute 过期与撤销状态。按用户撤销时必须同时包含 tenantId 和 userId。

### CSRF API

平台导出 Cookie/头名常量，以及令牌生成和安全比较函数。路由和客户端应复用这些常量；安全比较应避免普通字符串比较带来的时序差异。

## 7. `@jingwei/outbox`

### `IntegrationEvent`

跨模块异步事实，包含稳定事件类型和版本、发生时间、聚合/租户关联和 JSON 载荷。追加到 outbox 时平台生成唯一记录 ID。事件表达已经发生的事实，不应命名为命令。

### `PostgresOutboxAppender`

在业务事务中追加待发布事件。正确顺序是：修改业务状态 → 写审计 → 写 outbox → 提交事务。不能先发布消息再提交数据库。

### `OutboxWorker`

轮询未发布事件、调用 `EventDispatcher`、记录成功或失败。消费者仍必须幂等，因为“至少一次”交付可能产生重复事件。

## 8. `@jingwei/audit`

### `AuditWriter.append(entry)`

记录“谁在什么上下文对什么资源做了什么”。高价值修改应尽量把审计记录和业务状态放在同一事务。审计载荷不得包含密码、令牌、完整个人敏感信息或未过滤请求体。

## 9. `@jingwei/observability`

### `createLogger` 与 `AppLogger`

创建结构化日志器。使用字段而不是字符串拼接表达 `requestId`、`tenantId`、`moduleCode` 等上下文。日志用于运行诊断，不替代不可抵赖的审计记录。

## 10. `@jingwei/api-client`

### `createModuleApiClient<paths, prefix>(prefix)`

基于模块生成的 OpenAPI `paths` 创建 typed client，URL、path/query 参数、JSON body 和返回类型由 contract 推断。默认 `client` 基于 `toFlatTypedClient`，通过 `toApiResult()` 返回 `{ data, error }` 并将失败转换为 `ApiClientError`；`throwingClient` 仅用于应用启动等明确 fail-fast 流程。模块调用仍必须传入自己拥有的 Zod response schema，TypeScript 生成类型不替代运行时验证。

平台实例统一处理 Cookie、CSRF Header、`Accept`、30 秒默认超时和浏览器 `no-store`。普通传输错误不自动重试；受保护请求返回 401 时，平台会 single-flight 轮换 HttpOnly Refresh Cookie，并仅重放一次可重复请求。`@jingwei/api-client/vue` 的 `useApiRequestState()` 将 Fetch `onLoadingChange` 转为并发安全的只读 Vue loading；业务流程传递其 `options`，不得手工切换请求 loading。平台同时汇总 `onGlobalLoadingChange`。内置 cache/dedupe/Bearer refresh 默认关闭；模块页面需要 server-state 缓存时在 composable 上层单独设计。

### `ApiClientError`

服务端结构化失败保留 `code`、`message`、`requestId`、`status` 与可选 `details`。网络、超时、取消和响应 schema 失配使用稳定客户端 code；没有收到 HTTP 响应时 `status` 为 `null`。

### OpenAPI 生成

`pnpm api:generate` 从模块 route contract 生成模块自有 `paths`，`pnpm api:check` 验证生成物未漂移。运行时契约位于 `/openapi/v1.json`，Scalar UI 位于 `/docs`。

## 11. 模块 Public API

### IAM

`@jingwei/module-iam/server/public` 暴露授权决策、数据范围和认证所需的最小契约。其他模块不能读取 IAM 表，也不能导入 IAM 的仓储实现。

`createIamAccess(database, registry)` 返回 `IamAccess`：activeRoleIds(context)、roles(tenantId)、requirePermission(context, permission, capability)。当前实现检查活跃用户/角色与无数据范围的功能权限，不是完整 Data Scope evaluator；不支持的请求默认拒绝。

### Navigation

`@jingwei/module-navigation/server/public` 导出 NavigationSource 与 createNavigationManagement 工厂，封装本模块存储/事务和 IAM Public API 装配。管理用例负责权限、全量校验、乐观锁、发布/回滚以及同事务审计/Outbox。调用方不能绕过认证上下文。

`@jingwei/module-navigation/shared` 的 navigationTarget(node) 生成默认具体 URL；pathParameters(path) 只解析受支持的安全路径子集。它们不替代页面/API 对实际 params/query 的校验。客户端函数和完整 HTTP 契约见 [Navigation 接口](./http-api.md#6-navigation-接口)。

### Organization

`OrganizationQuery.descendantsOf(...)` 用于按租户展开组织后代 ID。独立的 `OrganizationSnapshot` 类型用于需要组织展示快照的公共查询，二者都避免泄露内部实体与 ORM/SQL 结构。

### Dictionary

`DictionaryQuery.findItems(...)` 用于按字典类型查询稳定条目快照。调用方不应直接依赖字典表结构。

## 12. 选择同步调用还是事件

| 需求                               | 选择                            |
| ---------------------------------- | ------------------------------- |
| 当前操作必须立即得到结果才能继续   | 模块 Public API                 |
| 只是通知其他模块一个已经发生的事实 | Integration Event               |
| 要求与业务写入原子落库             | 事务内追加 outbox               |
| 允许短暂最终一致                   | 事件消费者                      |
| 只是共享纯技术能力                 | platform 包，而不是业务模块 API |

新增公共 API 前先确认它不是临时实现细节；新增事件时要说明事件所有者、版本策略、幂等键和敏感字段策略。
