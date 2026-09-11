# ADR 0004: Use Server-side Session

- Status: Superseded by ADR 0011
- Date: 2026-09-01

## Context

企业 Web 需要可靠 logout、管理员强制下线、用户禁用/改密后的 revoke，以及权限变化及时生效。

## Decision

采用 Server-side Session + HttpOnly Cookie。Cookie 保存 CSPRNG opaque token；数据库只保存 hash。Session 同时具有 idle 与 absolute expiry；使用 Argon2id 密码散列，并对 unsafe cookie-auth request 实施 Origin Validation 与 CSRF Protection。

## Alternatives

复杂 JWT Access/Refresh 体系增加撤销与状态同步成本，不作为 V1 Web authentication。

## Consequences

PostgreSQL 是 V1 session store。移动端、Open API、第三方集成需要 OAuth/OIDC、PAT 或 service token 时另写 ADR。

ADR 0011 保留本 ADR 的服务端状态、opaque token、撤销、Origin 与 CSRF 决策，并将单一 Web Session Cookie 演进为短期 Access Token 与轮换 Refresh Token 两个 HttpOnly Cookie。
