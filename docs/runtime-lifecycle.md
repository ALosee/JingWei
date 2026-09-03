# 运行时生命周期

本文说明从构建到进程启动、匿名访问、登录、授权导航、数据库事务和退出的完整路径。理解这些路径后，才能正确决定代码应放在哪个 Package 或 Module。

## 1. 构建前生成

根命令会先选择 Edition：

```text
pnpm build
  -> edition:generate full
  -> build server
  -> Elegant Router generate
  -> Vite build web
```

Edition Builder 在构建前冻结 Server Module、Migration、Web Module 和 pageDir。生产进程不会扫描 `packages/modules` 来发现功能。

## 2. Server 启动

入口 `apps/server/src/index.ts` 只调用 `startServer()`；实际装配在 `bootstrap/start-server.ts`：

1. `loadConfig(process.env)` 使用 Zod 校验所有环境变量。
2. `createRuntime()` 创建 PostgreSQL Pool、Logger、SessionService、TenantDirectory 和 ModuleRegistry。
3. `createApp(runtime)` 创建 Hono Root App。
4. Root App 安装全局 Request Context Middleware。
5. 按生成顺序调用每个 `ServerModule.install(runtime)`。
6. 每个模块返回自己的 `basePath` 和 Hono Sub-App。
7. Root App 将模块挂载到 `/api/v1`。
8. `@hono/node-server` 开始监听。

若配置不合法，进程在监听端口前失败；模块安装或监听失败会释放已创建 Runtime。收到 `SIGINT`/`SIGTERM` 时调用 `createShutdown` 生成的关闭函数，先等待 HTTP 关闭，再释放 PostgreSQL Pool；多次调用复用同一 Promise。

## 3. Runtime 与显式依赖注入

Runtime 是 Composition Root 的资源集合，不是业务 Service Locator。只有 Server Module 安装阶段接收 Runtime；模块内部 Use Case 应通过构造函数获得自己需要的最小依赖。

```text
Runtime
  |- config
  |- database runtime
  |- logger
  |- module registry
  |- session service
  `- tenant directory
```

业务代码不得通过全局变量取得 Runtime，也不得在 Domain 中引用它。

## 4. 一次 HTTP 请求

`requestContextMiddleware` 只组合有序管线：`request-id` → `session-security` → `request-logging`。实现由各自中间件拥有，`app.ts` 只安装它们：

1. 读取 `x-request-id`；仅接受合法 UUIDv7，否则生成新的 Request ID。
2. 把 Request ID 写入 Hono Context 和响应头。
3. 默认设置 `authContext = null`。
4. 对非 GET/HEAD/OPTIONS 请求验证 `Origin`。
5. 若存在 Session Cookie，计算 Token Hash 并查询活动 Session。
6. 验证 idle/absolute expiry，更新 lastSeen 和 idle expiry。
7. 构造 `AuthContext`。
8. 对有身份的 unsafe request 校验 CSRF Cookie/Header/Hash。
9. 进入具体 Hono Route。
10. finally 阶段记录结构化 HTTP 日志。

未认证并不自动报错；公开接口可以继续。需要身份的 Route/Application Adapter 必须明确拒绝 `authContext === null`。

安全中间件提前拒绝的请求不会进入后置访问日志中间件，仍进入统一错误边界。该执行顺序在结构拆分中保持不变。

## 5. Error 生命周期

可预期业务/应用失败抛出 `ApplicationError`：

```ts
throw new ApplicationError({
  code: 'AUTHENTICATION_REQUIRED',
  message: '需要登录后访问',
  status: 401,
})
```

`http/errors.ts` 拥有 Root Error Handler，`app.ts` 只调用安装函数。它将所有错误映射为：

```json
{
  "code": "STABLE_ERROR_CODE",
  "message": "安全、可展示的信息",
  "requestId": "UUIDv7",
  "details": {}
}
```

未知异常变为 `INTERNAL_ERROR`，不向客户端泄露 stack、SQL 或 Driver Error；原始异常只进入服务端受控日志。

## 6. Web 启动

入口 `apps/web/src/main.ts` 只调用 `startWebApplication()`。`bootstrap/start-web.ts` 创建对象并注入依赖，`navigation/initialize-navigation.ts` 编排导航，`navigation/initial-location.ts` 选择首屏目标：

1. 创建 Vue App、Pinia 和只包含 Bootstrap/Recovery 的最小 Router。
2. 请求 `GET /api/v1/navigation/bootstrap`。
3. 将 PUBLIC Navigation Node 按 routeKey 映射到 Edition Page Registry。
4. 请求 `GET /api/v1/iam/session`，以 `200` 响应恢复登录/匿名状态。
5. 只有会话有效时才请求 `GET /api/v1/navigation/me`。
6. 已登录时用完整用户投影替换动态 Route，清除旧路径和旧权限页面。
7. 使用页面加载前保存的原始 URL 重新解析一次，修复动态 Route 尚未安装时被 catch-all 捕获的问题。
8. `/` 优先跳转可见 homeCode，再选第一个非公开 MENU；匿名用户跳转 authEntryCode。
9. 任一 Registry/Navigation 错误都跳转 `/__recovery`。

Static Recovery 不依赖动态配置，因此数据库误配置或 Navigation 发布错误不会让整个前端失去入口。

导航流程不直接依赖 Vue、Pinia 或 window。加载、安装、识别和跳转操作由装配层注入，可独立测试启动顺序、匿名不请求 me、会话竞态和错误恢复。Router 通过工厂创建，不在 import 时创建实例。职责说明见 [代码结构](./code-structure.md)。

刷新 `/signin`、`/account` 等动态 URL 时，Vue Router 的第一次匹配可能早于 Navigation 请求完成。Web 必须在安装动态 Route 后对原 URL 执行 `router.replace` 重新匹配；仅检查当前 route name 会把合法地址错误保留在静态 Recovery。

## 7. 登录

```text
Login Form
  -> POST /api/v1/iam/sessions
  -> Zod validate
  -> resolve active tenant by code
  -> find user credential inside tenant
  -> Argon2id verify
  -> create opaque Session + CSRF token
  -> database stores only hashes
  -> Set-Cookie session(HttpOnly) + csrf(readable)
  -> browser reloads /
  -> bootstrap + session status + /navigation/me
```

登录失败统一返回相同错误，避免暴露租户、用户或状态是否存在。

## 8. Session 活动与退出

每次携带 Session Cookie 的请求都会验证：

- Session 未撤销；
- 当前时间早于 idle expiry；
- 当前时间早于 absolute expiry。

认证成功后，idle expiry 最多延长到 absolute expiry。Logout 调用 `DELETE /api/v1/iam/sessions/current`，先撤销数据库 Session，再删除 Cookie。

用户禁用或改密的 Application Use Case 应调用 `SessionService.revokeUser()`；当前 Foundation 已提供能力，但尚未实现完整用户管理 Use Case。

## 9. Navigation 解析

Navigation Server 先加载已发布配置，再用 ModuleRegistry 验证：

- routeKey 存在；
- required Capability 已启用；
- Permission Definition 存在；
- access mode 在代码允许列表中；
- path 无冲突且不覆盖 Recovery；
- parent 存在且无循环；
- external URL 使用 HTTPS；
- auth entry 指向 PUBLIC-capable Route。

`bootstrap()` 通过真实租户读取 PostgreSQL 当前发布版本，只返回 PUBLIC 节点及必要容器。匿名租户来自 tenantCode 或 BOOTSTRAP_TENANT_CODE；已登录始终使用 Session tenantId。无发布版本返回 503，不使用静态配置掩盖故障。

`forUser()` 通过 IAM Public API 查询活跃角色，合并 Navigation 自有 role_navigation 的 code grants，返回 PUBLIC、AUTHENTICATED 和获授 code 的 PERMISSION 节点。外链无需 routeKey；目录/分组由可见后代推导。MENU 安装路由并显示菜单，PAGE 只安装路由。

管理接口另外检查 navigation.view/manage/publish 等功能权限。发布/回滚锁住租户导航根并比较预期指针，与审计、Outbox 同事务提交；历史发布快照不可修改。完整语义见 [导航设计](./navigation-routing-design.md)。

## 10. Application Transaction

业务事务应由 Application Use Case 控制：

```text
transaction.execute
  |- repository.save(aggregate)
  |- outbox.append(integrationEvent)
  `- commit
```

Repository 不得自己开启、提交业务事务。重要状态变更和 Outbox 必须使用同一个 Kysely Transaction，保证“业务成功但事件丢失”不会发生。

## 11. Outbox Worker

`PostgresOutboxRepository.claimBatch()` 在短事务中：

1. 查询到期、未发布、未锁定或锁已过期的事件；
2. 使用 `FOR UPDATE SKIP LOCKED` 避免 Worker 互相阻塞；
3. 设置 workerId、lockedAt，并增加 attempts；
4. 提交事务后交给 EventDispatcher。

投递成功写 `published_at`；失败记录截断后的错误、计算重试时间并释放锁。Worker 代码已具备，独立进程入口和具体 Dispatcher 尚未接线。

## 12. Migration 生命周期

`pnpm migration:up`：

1. 加载并校验 Config；
2. 创建 DatabaseRuntime；
3. 读取 Edition Builder 生成的 Migration Map；
4. 交给 Kysely Migrator；
5. 按全局 timestamp 执行尚未执行的 Migration；
6. 输出每个 Migration 状态并释放 Pool。

生产环境不动态 import 文件系统中的任意 migration。停用模块不会调用 `down()`，也不会自动 DROP Schema。

## 13. 日志与审计的区别

- Log 面向运行诊断，可按保留策略删除，不是业务证据。
- Audit 面向“谁在何时对哪个实体做了什么”，原则上 append-only。
- Outbox 面向跨模块事实的可靠投递。

一次关键写操作可能同时产生结构化日志、审计记录和 Integration Event，但三者用途不同，不能互相替代。
