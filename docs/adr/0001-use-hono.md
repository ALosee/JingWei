# ADR 0001: Use Hono

- Status: Accepted
- Date: 2026-09-01

## Context

项目由熟悉 TypeScript 的个人开发者长期全栈开发，需要共享 API Contract、低上下文切换成本，同时必须补足企业应用架构护栏。

## Decision

Node.js 24 LTS 上使用 Hono 与 `@hono/node-server`。Hono 仅作为 HTTP adapter，模块使用 sub-app，生产由 tsdown 构建，开发由 tsx 运行；依赖注入显式完成。RPC client 按 Module 拆分。

## Alternatives

Spring Boot/Spring Modulith 的企业护栏更成熟；NestJS 提供完整 DI/Decorator 框架；裸 Express 更自由。它们均不符合已确定的个人 TS 全栈效率与轻量 composition 目标。

## Consequences

仓库必须自行实现 Architecture Check、模块 SDK、事务/错误/日志/认证规范。禁止在 route 写业务逻辑，也禁止形成全平台 Mega AppType。
