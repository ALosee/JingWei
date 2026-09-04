# `@jingwei/auth`

与业务身份模型无关的认证安全基础：密码摘要、会话令牌、会话持久化、Origin 和 CSRF 校验。用户、角色、权限和数据范围仍由 IAM 模块拥有。

## 包边界

本包拥有 `platform.auth_session` 和相应迁移，但不拥有用户表。它只使用已确认的 `TenantId`、`UserId` 创建会话。

| API                         | 作用                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `PasswordHasher`            | 密码 hash/verify 端口                                                                 |
| `Argon2idPasswordHasher`    | 固定安全参数的 Argon2id 实现                                                          |
| `SessionRepository`         | 会话持久化端口                                                                        |
| `PostgresSessionRepository` | PostgreSQL 实现                                                                       |
| `SessionService`            | 创建、认证、滑动过期、撤销会话                                                        |
| `hashOpaqueToken`           | 对随机令牌生成 SHA-256 摘要                                                           |
| `tokenMatchesHash`          | 恒定时间策略比较令牌摘要                                                              |
| Cookie/CSRF 常量与函数      | HTTP 安全边界共享契约                                                                 |
| `./shared`                  | 浏览器安全的 session/CSRF Cookie 与 Header 名常量，不引入 Node/Argon2/PostgreSQL 实现 |
| `./migrations`              | `platform.auth_session` 迁移                                                          |

## 密码

```ts
const hasher = new Argon2idPasswordHasher()
const hash = await hasher.hash(password)
const valid = await hasher.verify(hash, candidate)
```

数据库只保存 Argon2 编码摘要。认证失败时，IAM 路由使用统一结果，避免暴露“用户不存在”还是“密码错误”。算法参数升级应支持登录时 rehash 或受控批次，不直接破坏历史摘要。

## 会话

`SessionService.create` 生成两个 256-bit 随机值：

- session token：浏览器证明会话；
- CSRF token：修改型请求的双提交令牌。

数据库只保存二者的 SHA-256 摘要。返回的 `CreatedSession` 是唯一包含原始 token 的短生命周期对象，只能由登录路由写入 Cookie，禁止日志记录或长期缓存。

`authenticate` 同时检查：token 摘要、未撤销、idle 未过期、absolute 未过期。成功后延长 idle 时间，但永远不超过 absolute 时间。

`revoke` 撤销单个会话；`revokeUser` 可用于密码重置、账户禁用或安全事件后撤销用户全部会话。

## HTTP 安全

- `requiresOriginValidation`：GET/HEAD/OPTIONS 以外的方法需要来源校验；
- `isAllowedOrigin`：当前为精确字符串匹配；
- `isValidCsrfToken`：要求 Cookie 与请求头相同，并与会话中摘要恒定时间匹配；
- Cookie/头名由本包统一导出，应用和模块不要重复硬编码。

Origin 校验发生在请求中间件最前部；已认证的修改请求还要通过 CSRF。业务路由仍负责权限和数据范围。

## 安全不变量

- 原始密码和令牌不进入数据库、日志、审计和 outbox；
- 会话 Cookie 使用 HttpOnly；CSRF Cookie 必须允许前端读取；
- 生产 HTTPS 启用 Secure，并核对 SameSite/Domain/Path；
- 所有有效期依赖注入的 `Clock`；
- 撤销和过期在查询条件中生效，不只靠调用方检查；
- 令牌比较不使用普通字符串直接比较摘要。

身份、授权的完整设计见 [身份与授权设计](../../../docs/identity-authorization-design.md)。
