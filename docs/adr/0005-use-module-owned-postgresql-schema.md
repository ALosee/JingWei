# ADR 0005: Use Module-owned PostgreSQL Schema

- Status: Accepted
- Date: 2026-09-01

## Context

模块必须可裁剪、独立迁移并为未来服务拆分留出边界，同时 V1 不希望承担多数据库运维。

## Decision

使用一个 PostgreSQL Database，每个 Module 一个 owned schema。模块内可建 FK；跨模块只保存 UUID，不建 FK、不直接 SQL/DDL。V1 通过 ApplicationContext/Repository 做租户隔离，不使用 RLS。

## Alternatives

所有表放 public 会弱化所有权；每模块独立数据库增加当前运维与事务成本；跨模块 FK 会锁死模块生命周期。

## Consequences

每张表和 migration 必须能回答唯一 Owner。Architecture Check 与 review 负责阻止跨 schema 访问。停用模块保留历史数据，不自动 drop。
