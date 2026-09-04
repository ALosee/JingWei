# Jingwei / 经纬企业平台

Jingwei is a tenant-aware, edition-composable enterprise platform foundation built as a TypeScript modular monolith.

This repository contains only the platform foundation: module manifests and boundary checks, edition-aware registries, Hono/Vue shells, PostgreSQL/Kysely migrations, Cookie authentication, audit/outbox infrastructure, and database-backed navigation with draft/publish/rollback and role navigation grants. Organization and dictionary remain foundation skeletons, not business applications.

## Requirements

- Node.js 24 LTS or newer
- pnpm 10
- PostgreSQL 18 for migrations and runtime integration

## Commands

```bash
pnpm install
pnpm edition:generate development
pnpm migration:up
DEV_ADMIN_PASSWORD='<至少 12 个字符>' pnpm seed:dev
pnpm seed:navigation
pnpm dev
# 仅在需要使用仓库根目录 .env.test 联调时：
pnpm dev:test

pnpm typecheck
pnpm lint
pnpm format:check
pnpm architecture:check
pnpm test
TEST_ADMIN_PASSWORD='<开发管理员密码>' pnpm test:auth:real
pnpm test:navigation:real
pnpm build
```

Local infrastructure can be started with `docker compose -f docker-compose.dev.yml up -d`. Database migrations use `pnpm migration:status` and `pnpm migration:up` after generating the target Edition.

`pnpm dev` uses the repository-level `.env`, `.env.local`, `.env.development`, and `.env.development.local` files. `.env.test` is intentionally isolated from normal development and is loaded by `pnpm dev:test` only. Environment files are ignored by Git except for `.env.example`.

Migration/seed/test commands require explicitly supplied environment variables. For the local `.env.test` database, see the [exact initialization commands](./tooling/migration/README.md#显式使用-envtest). `seed:navigation` preserves existing passwords and published configuration; `seed:dev` updates the development password. Navigation bootstrap now reads a published database version and returns 503 until one exists.

## Documentation

Code quality uses ESLint; formatting and import sorting use Oxfmt. Run `pnpm lint:fix` for lint fixes and `pnpm format` for formatting. `pnpm check` runs all local quality gates, including the read-only formatting check. See the [formatting and editor setup](./docs/development-guide.md#14-lint格式化与导入排序).

Start at the [documentation center](./docs/README.md). It provides reading paths and detailed guides for:

- Product → Edition → Module → Capability → Permission → Data Scope;
- repository and module boundaries;
- server/web runtime lifecycle;
- current HTTP and TypeScript APIs;
- database, authentication, authorization, navigation and outbox design;
- development, testing, deployment and troubleshooting.

Every app, platform package, business module and tooling package has a nearby README documenting its responsibilities, public API, invariants and current implementation status. Read [AGENTS.md](./AGENTS.md) before making changes; it contains mandatory engineering rules.
