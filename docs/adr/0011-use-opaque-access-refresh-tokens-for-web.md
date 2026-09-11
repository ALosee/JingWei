# ADR 0011: Use Opaque Access and Refresh Tokens for Web

- Status: Accepted
- Date: 2026-09-10
- Supersedes: ADR 0004 的单 Cookie 会话协议

## Context

单一长生命周期 Session Cookie 能满足基础登录，但无法单独限制日常请求凭据的暴露时间，也不能通过 refresh rotation 识别长效凭据复用。平台还需要为未来微信网站登录、小程序、原生客户端和开放 API 保留登录方式与凭证传输的独立演进边界。

Jingwei 当前是同站 Web 与 Modular Monolith，不需要把用户身份、角色或权限编码进可离线验证的 JWT，也没有 Redis 带来的独立吞吐或故障域需求。

## Decision

Web 使用服务端有状态的 opaque access/refresh token family：

- Access Token 为 256-bit CSPRNG opaque value，默认 10 分钟有效，通过 jingwei_access HttpOnly Cookie 携带；
- Refresh Token 为独立 256-bit opaque value，受 30 分钟 idle 与 7 天 absolute expiry 约束，通过仅匹配刷新端点的 jingwei_refresh HttpOnly Cookie 携带；
- 数据库只保存 SHA-256 token hash。当前 access hash 位于 platform.auth_session，每一代 refresh hash 位于 platform.auth_refresh_token；
- 每次刷新在一个 PostgreSQL transaction 中消费旧 generation、写入新 generation 并替换 access hash。已消费 refresh hash 保留用于 replay detection；
- 同一 refresh generation 在 5 秒并发窗口内再次出现返回可重试冲突，超过窗口则视为复用并撤销整个 family；
- 两个认证 Cookie 均使用 HttpOnly、SameSite=Strict、host-only，生产启用 Secure。Refresh Cookie Path 固定为 /api/v1/iam/sessions/refresh；
- CSRF Cookie 仍允许 JavaScript 读取。所有 unsafe 请求精确校验 Origin；已认证修改和 refresh 还必须校验双提交 CSRF；
- PostgreSQL 继续作为唯一会话事实源，不引入 Redis，不使用 JWT。

Web 请求边界负责 Cookie transport 和 single-flight refresh；IAM Application/Domain 与业务模块只消费 AuthContext，不读取 Cookie。登录方式与凭证传输保持分离：未来微信网站 OAuth 回调完成 code/state 校验后可签发相同 Web Cookie，其中回调前的短期 state/nonce 需要独立的一次性服务端记录或 SameSite=Lax 临时 Cookie，不能复用 Strict Refresh Cookie。微信小程序、原生客户端和机器调用应增加 Bearer/PAT 等独立适配器，而不是模拟浏览器 Cookie。

## Alternatives

- Access Token 放内存、Refresh Token 放 HttpOnly Cookie：便于浏览器直接调用多个资源服务器，但会把 access token 暴露给页面脚本，不适合当前第一方企业 Web。
- JWT Access/Refresh：离线验证不能满足禁用用户、改密、角色变化和即时撤销要求，仍会引入状态同步。
- 单一 opaque Session Cookie：实现更简单，但日常凭据与续期凭据具有同一生命周期，缺少 refresh rotation/replay detection。
- Redis Session Store：当前 PostgreSQL 容量、延迟和故障域足够；在有真实独立扩容证据前不增加基础设施。

## Consequences

客户端无法读取凭据，必须通过 session endpoint 恢复安全用户摘要。Cookie 自动携带意味着 CSRF 仍是强制安全边界，HttpOnly 也不能阻止同源恶意脚本代用户发请求。

该传输适合第一方同站 Web，不适合需要 JavaScript 把 token 转发给多个独立资源域、无标准浏览器 Cookie Jar 的小程序/原生客户端、第三方 API 调用或服务间通信；这些场景共享身份与撤销策略，但使用独立的凭证适配器。

刷新涉及代际状态和多标签页并发。前端在页面内 single-flight，并在浏览器支持时通过 Web Locks 跨标签页串行化；服务端并发窗口负责兼容不支持 Web Locks 的客户端。

迁移无法从旧 session 的单个 raw token 推导出 refresh token，因此升级会显式撤销已有登录，用户需要重新认证。
