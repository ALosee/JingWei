# `@jingwei/config`

Jingwei 的集中配置解析包。它把不可信的 `process.env` 转换为经过验证、不可变的 `AppConfig`。

## 公共 API

### `loadConfig(environment)`

接收显式 `NodeJS.ProcessEnv`，使用 Zod 完成类型转换、默认值和约束检查。显式参数使测试无需修改全局 `process.env`。

### `AppConfig`

返回的业务友好配置：

| 字段                               | 环境变量                           | 默认值                   |
| ---------------------------------- | ---------------------------------- | ------------------------ |
| `environment`                      | `NODE_ENV`                         | `development`            |
| `http.host`                        | `HTTP_HOST`                        | `127.0.0.1`              |
| `http.port`                        | `HTTP_PORT`                        | `3000`                   |
| `http.trustProxy`                  | `HTTP_TRUST_PROXY`                 | `false`                  |
| `http.secureCookies`               | `COOKIE_SECURE`                    | 按 `APP_ORIGIN` 协议推导 |
| `databaseUrl`                      | `DATABASE_URL`                     | 本地 Jingwei PostgreSQL  |
| `appOrigin`                        | `APP_ORIGIN`                       | `http://localhost:5173`  |
| `bootstrapTenantCode`              | `BOOTSTRAP_TENANT_CODE`            | `default`                |
| `session.accessSeconds`            | `AUTH_ACCESS_TOKEN_SECONDS`        | `600`                    |
| `session.refreshIdleSeconds`       | `AUTH_REFRESH_IDLE_SECONDS`        | `1800`                   |
| `session.refreshAbsoluteSeconds`   | `AUTH_REFRESH_ABSOLUTE_SECONDS`    | `604800`                 |
| `session.refreshReuseGraceSeconds` | `AUTH_REFRESH_REUSE_GRACE_SECONDS` | `5`                      |
| `login.maxFailedAttempts`          | `AUTH_LOGIN_MAX_FAILED_ATTEMPTS`   | `5`                      |
| `login.lockSeconds`                | `AUTH_LOGIN_LOCK_SECONDS`          | `900`                    |

额外约束：access 有效期必须严格小于 refresh idle，二者都必须严格小于 refresh absolute；refresh 复用并发窗口最大为 30 秒；登录失败阈值为 3–20 次，锁定时间为 60–86400 秒；端口必须在合法范围；数据库 URL 必须使用 PostgreSQL 协议。`APP_ORIGIN` 使用 HTTPS 时禁止显式关闭 Secure Cookie；HTTP 内网环境可由协议自动得到非 Secure Cookie，而不是借用 `NODE_ENV` 猜测传输协议。

bootstrapTenantCode 用于匿名 Navigation bootstrap 的默认租户选择，仍须通过 TenantDirectory 找到活跃租户。已登录请求只使用 Session tenantId，不受此配置或 query 租户影响。

## 使用

```ts
const config = loadConfig(process.env)
const runtime = new DatabaseRuntime(config.databaseUrl)
```

只在应用组合根调用一次，然后通过明确的模块上下文传递。业务模块不能再次读取环境变量，因为那会让配置验证、测试和部署审计失去统一入口。

## 安全

- 不记录完整 `DATABASE_URL` 或未来的 Secret；
- 默认值只面向本地开发，不是生产安全配置；
- `APP_ORIGIN` 是安全边界，生产必须精确匹配实际 Web 来源；
- `HTTP_TRUST_PROXY` 只可在请求必经受信代理且代理会清洗并重写 `X-Forwarded-For` 时开启；否则审计 IP 只取直连地址；
- `COOKIE_SECURE` 表达实际 HTTPS 能力；生产和预发布应优先使用 HTTPS，并保持为 `true`；
- 新增敏感配置时优先返回语义化对象，而不是到处传递原始字符串；
- 配置错误应在启动阶段快速失败。

## 新增配置项

1. 在 Zod schema 中定义输入、转换和边界；
2. 在 `AppConfig` 中定义业务友好名称；
3. 在 `loadConfig` 返回值中映射并冻结；
4. 为默认值、非法值和跨字段约束补测试；
5. 更新本 README 与 [运维手册](../../../docs/operations.md)；
6. 更新部署模板，但不要提交真实 Secret。
