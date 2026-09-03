# ADR 0002: Use Kysely

- Status: Accepted
- Date: 2026-09-01

## Context

企业平台会大量使用 JOIN、CTE、聚合、窗口函数、锁与报表查询，需要接近 SQL 的类型安全工具，并需要按 Edition 静态组合模块 Migration。

## Decision

使用 Kysely + `pg` 访问 PostgreSQL 18。业务代码通过 module repository 使用 Kysely；平台 database package 管理连接、transaction 与 migration runtime。使用自定义 generated MigrationProvider。

## Alternatives

Prisma/TypeORM 提供更强 ORM 抽象但不符合 SQL-first 需求；Drizzle 未被基线选中；直接 `pg` 会失去统一类型与 query composition。

## Consequences

不建立万能 Generic Repository。Database Row 不对 Web 暴露；Migration 由 Owner Module 提供，生产不扫描任意源码目录。
