# ADR 0003: Use Modular Monolith

- Status: Accepted
- Date: 2026-09-01

## Context

平台将包含大量业务域，但当前由个人开发、统一部署。过早微服务化会把精力消耗在分布式事务、部署、故障与运维，而无法自动带来正确边界。

## Decision

V1 使用 Modular Monolith。Module 是第一架构边界，拥有 vertical slice、schema、migration、public API 与 events。模块通信只允许 Public API、Integration Event、Transactional Outbox。

## Alternatives

传统 MVC 会按技术层横切并妨碍裁剪；微服务会过早增加运行时复杂度。

## Consequences

必须通过显式 exports、Manifest DAG、Architecture Check 和数据库所有权持续强制边界。只有可证明的独立扩容、故障/安全域、团队或技术差异才能通过 ADR 拆服务。
