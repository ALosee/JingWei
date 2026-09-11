# `@jingwei/server`

Jingwei 的服务端组合根。它负责把配置、数据库、会话、可观测性、Edition 和业务模块装配成一个可运行的 Hono HTTP 服务。

## 职责边界

本应用负责：

- 在启动边界读取并验证环境配置；
- 创建和释放数据库连接池；
- 根据构建期生成的 Edition 创建 `ModuleRegistry`；
- 创建会话服务、租户目录、日志器等共享运行时对象；
- 安装 Edition 中的 Server Module；
- 建立 requestId、会话、Origin、CSRF 与请求日志中间件；
- 统一处理 404 和应用异常；
- 暴露 `/health` 与 `/api/v1`。

本应用不负责：

- 实现具体业务规则；
- 直接拥有业务表；
- 决定模块依赖或产品 Edition；
- 让路由绕过模块用例直接写数据库。

## 目录

```text
src/
├── bootstrap/
│   ├── start-server.ts        # 依赖装配、监听、信号注册
│   ├── runtime.ts             # 进程级资源创建和释放
│   └── shutdown.ts            # 幂等关闭流程
├── generated/                 # Edition Builder 生成，禁止手工维护
├── http/                      # 系统路由、统一错误协议适配
├── middleware/                # request-context 装配 ID、安全、日志中间件
├── app.ts                     # 只装配 HTTP 管线和模块
└── index.ts                   # 只调用 startServer
```

## 启动流程

`index.ts` 只调用 `startServer()`。进程装配位于 `bootstrap/start-server.ts`，不会在导入 `app.ts` 或启动实现文件时自动监听端口。

1. `createRuntime(process.env)` 调用 `loadConfig`；
2. 创建 `DatabaseRuntime` 和结构化日志器；
3. 创建 PostgreSQL 会话仓储、`SessionService` 与租户目录；
4. 使用生成的 `ResolvedEdition` 创建 `ModuleRegistry`；
5. `createApp` 按生成顺序调用每个模块的 `install`；
6. 把模块路由挂到 `/api/v1/<module-base-path>`；
7. Node adapter 开始监听；
8. 收到退出信号后通过 `createShutdown` 停止接受请求，等待 HTTP 关闭后调用 `runtime.dispose()`。

安装模块或监听失败时释放已创建的 Runtime。关闭函数的多次调用复用同一 Promise，避免重复释放；即使 HTTP 关闭失败也会尝试释放数据库。生命周期测试验证关闭顺序和失败清理。

生成顺序已经满足模块依赖，模块安装代码不应再次自行排序。

Navigation 的 install 通过 IAM 公开工厂获取活跃角色/功能授权服务，装配 PostgreSQL NavigationStore、事务边界和管理用例；不跨模块查询 IAM 表。公开 bootstrap 用 TenantDirectory 解析 BOOTSTRAP_TENANT_CODE（默认 default），运行时不会自动建导航或覆盖发布配置。迁移后本地显式运行 seed:navigation，详见 [迁移工具](../../tooling/migration/README.md)。

## 请求处理顺序

`requestContextMiddleware` 返回有序中间件元组，由 `app.use` 安装，不是一个承担所有实现的 handler：

- `request-id.ts`：建立 requestId 和初始身份上下文；
- `session-security.ts`：Origin、会话恢复和 CSRF；
- `request-logging.ts`：记录通过安全阶段后的 HTTP 请求结果。

执行顺序：

1. 接受合法 UUIDv7 `x-request-id`，否则生成新 ID；
2. 对修改型请求验证 Origin；
3. 读取短期 Access Token Cookie，并通过摘要查询活动 Token Family，恢复 `AuthContext`；
4. 已登录的修改型请求继续验证 CSRF Cookie 与请求头；
5. 执行路由；
6. 在 `finally` 中记录 method、path、status、duration 和安全上下文。

中间件只建立身份上下文。具体路由仍要决定是否允许匿名、需要何种权限和数据范围。

安全阶段提前拒绝的请求不会进入后置访问日志中间件，仍由统一错误边界处理；本次职责拆分保留原有顺序。

## 关键 API

| API                                 | 作用                                                      |
| ----------------------------------- | --------------------------------------------------------- |
| `createRuntime(environment?)`       | 创建一个进程级、可释放的运行时；测试可以传入显式环境      |
| `Runtime.dispose()`                 | 关闭数据库池；未来的 worker/客户端也应纳入这里            |
| `createApp(runtime)`                | 安装中间件与 Edition 模块，返回尚未监听端口的 Hono app    |
| `startServer()`                     | 进程边界：装配、监听、注册关闭信号，启动失败时清理        |
| `createShutdown(dependencies)`      | 返回一次性、可重复调用的关闭流程，HTTP drain 先于资源释放 |
| `requestContextMiddleware(runtime)` | 返回 requestId → security → logging 的有序中间件元组      |

`createApp` 不直接监听端口，因此可在 HTTP 合约测试中复用。

## 错误契约

已知失败应抛出 `ApplicationError`。顶层错误处理器输出稳定的 `code`、面向人的 `message`、`requestId` 和可选安全 `details`。未知异常记录内部原因，但对外统一为 `INTERNAL_ERROR`。

当前允许的响应状态为 `400/401/403/404/409/422/500/503`；未受支持的内部状态会归一化为 `500`。

Hono 在 Zod hook 之前解析 JSON。其 400 解析异常也统一映射为安全的 INVALID_REQUEST/400，不能误报为内部 500 或直接返回底层解析信息。

## 开发与运行

```bash
pnpm --filter @jingwei/server dev
pnpm --filter @jingwei/server dev:test
pnpm --filter @jingwei/server build
pnpm --filter @jingwei/server start
```

`dev` 按开发模式读取仓库根目录的 `.env`、`.env.local`、`.env.development` 和 `.env.development.local`；`dev:test` 明确读取 `.env.test`。`tsx` 不会仅因文件存在就自动加载任意 `.env*`，所以不要把测试配置写入 `.env.test` 后仍用普通 `dev` 启动。

`start` 运行 `dist/index.mjs`，用于验证真正的生产 bundle；不要用 `tsx src/index.ts` 代替生产启动验证。

## 修改检查表

- 新共享依赖只在 `createRuntime` 创建，并通过模块上下文传递；
- `index.ts` 保持调用式入口，`app.ts`/模块工厂只注册导入的 handler，不内联协议或功能实现；
- 新资源有明确 `dispose` 顺序；
- 中间件顺序的安全影响有测试；
- 错误响应不泄露 cause、stack、SQL 或 Secret；
- 构建后从纯 Node.js 入口启动并检查 `/health`；
- 同步更新 [HTTP API 手册](../../docs/http-api.md) 和 [运维手册](../../docs/operations.md)。

系统性结构约束和自动检查见 [代码职责与入口约束](../../docs/code-structure.md)。
