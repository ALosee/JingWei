# 经纬文档中心

本目录是经纬企业平台的工程知识入口。`AGENTS.md` 是强制规则，`docs/` 负责解释这些规则背后的模型、运行方式和扩展方法；二者发生歧义时，以 `AGENTS.md` 和已批准 ADR 为准。

## 推荐阅读路径

### 第一次进入项目

1. 阅读根目录 `README.md`，确认环境与常用命令。
2. 阅读 `AGENTS.md`，了解不可违反的边界。
3. 阅读 [架构基线](./architecture.md)，形成 Product、Edition、Module、Capability、Permission、Data Scope 的整体认识。
4. 阅读 [Edition 与 Module 手册](./edition-module-handbook.md)，理解构建裁剪和模块装配。
5. 阅读 [运行时生命周期](./runtime-lifecycle.md)，理解 Web、Server、Session、Navigation 和数据库如何协作。
6. 阅读 [代码职责与入口约束](./code-structure.md)，区分入口、装配、功能流程与展示。
7. 按任务进入相应 Module 或 Platform Package 的 README。

### 开发一个新模块

1. [Module Design](./module-design.md)
2. [Edition 与 Module 手册](./edition-module-handbook.md)
3. [Database Design](./database-design.md)
4. [开发指南](./development-guide.md)
5. `tooling/module-generator/README.md`
6. `tooling/architecture-check/README.md`

### 修改登录、权限或导航

1. [Identity & Authorization](./identity-authorization-design.md)
2. [Navigation & Routing](./navigation-routing-design.md)
3. [HTTP API](./http-api.md)
4. `packages/modules/iam/README.md`
5. `packages/modules/navigation/README.md`
6. `packages/platform/auth/README.md`

### 发布和排障

1. [运行与运维](./operations.md)
2. [测试与质量门禁](./testing-quality.md)
3. [运行时生命周期](./runtime-lifecycle.md)
4. 对应 ADR 与 Package README

## 文档地图

| 文档                                                                   | 回答的问题                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| [architecture.md](./architecture.md)                                   | 系统的最高层架构是什么？                                     |
| [repository-structure.md](./repository-structure.md)                   | 代码放在哪里，为什么这样分？                                 |
| [code-structure.md](./code-structure.md)                               | 入口、装配、流程、规则、适配器、页面怎样分工，如何自动约束？ |
| [edition-module-handbook.md](./edition-module-handbook.md)             | Edition、Module、Capability 如何解析和裁剪？                 |
| [module-design.md](./module-design.md)                                 | 一个模块内部如何分层、如何与其他模块通信？                   |
| [database-design.md](./database-design.md)                             | Schema、Tenant、ID、Migration 如何设计？                     |
| [identity-authorization-design.md](./identity-authorization-design.md) | 登录、Session、RBAC、Data Scope 如何工作？                   |
| [navigation-routing-design.md](./navigation-routing-design.md)         | routeKey、Navigation、Permission、Vue 页面如何解耦？         |
| [runtime-lifecycle.md](./runtime-lifecycle.md)                         | 进程启动和一次请求经历哪些阶段？                             |
| [http-api.md](./http-api.md)                                           | 当前 HTTP API、Cookie、错误结构是什么？                      |
| [api-reference.md](./api-reference.md)                                 | 关键 TypeScript API 的职责和使用约束是什么？                 |
| [development-guide.md](./development-guide.md)                         | 如何安全地增加模块、能力、路由和迁移？                       |
| [testing-quality.md](./testing-quality.md)                             | 如何测试，CI 为什么会失败？                                  |
| [operations.md](./operations.md)                                       | 如何配置、迁移、构建、启动和排障？                           |
| [glossary.md](./glossary.md)                                           | 项目术语的精确定义是什么？                                   |
| [references/soybean-ui.md](./references/soybean-ui.md)                 | SoybeanUI Skill、AI 文档和上游版本如何固定与更新？           |

## 子项目文档

### 应用与 Edition

| 子项目        | 文档                                    |
| ------------- | --------------------------------------- |
| Server 组合根 | [apps/server](../apps/server/README.md) |
| Web 应用壳    | [apps/web](../apps/web/README.md)       |
| 产品 Edition  | [editions](../editions/README.md)       |

### 业务模块

| 模块         | 文档                                                                        | 当前定位                         |
| ------------ | --------------------------------------------------------------------------- | -------------------------------- |
| IAM          | [packages/modules/iam](../packages/modules/iam/README.md)                   | 用户、凭据、角色、权限与数据范围 |
| Navigation   | [packages/modules/navigation](../packages/modules/navigation/README.md)     | 发布导航、路由校验与用户导航解析 |
| Organization | [packages/modules/organization](../packages/modules/organization/README.md) | 组织树、岗位与用户组织关系       |
| Dictionary   | [packages/modules/dictionary](../packages/modules/dictionary/README.md)     | 租户字典类型和条目               |

### Platform Packages

| 包            | 文档                                                   | 核心能力                                |
| ------------- | ------------------------------------------------------ | --------------------------------------- |
| kernel        | [README](../packages/platform/kernel/README.md)        | ID、上下文、错误、时间、分页            |
| config        | [README](../packages/platform/config/README.md)        | 环境配置解析                            |
| database      | [README](../packages/platform/database/README.md)      | PostgreSQL 运行时、事务、迁移、租户目录 |
| module-sdk    | [README](../packages/platform/module-sdk/README.md)    | Manifest、Edition、Registry、模块契约   |
| auth          | [README](../packages/platform/auth/README.md)          | 密码、会话、Origin 与 CSRF              |
| api-client    | [README](../packages/platform/api-client/README.md)    | Soybean Fetch + OpenAPI 模块客户端      |
| http-contract | [README](../packages/platform/http-contract/README.md) | 平台 HTTP 错误与安全方案契约            |
| audit         | [README](../packages/platform/audit/README.md)         | 审计写入                                |
| observability | [README](../packages/platform/observability/README.md) | 结构化日志                              |
| outbox        | [README](../packages/platform/outbox/README.md)        | 事务发件箱与 worker                     |
| storage       | [README](../packages/platform/storage/README.md)       | 对象存储端口                            |
| testing       | [README](../packages/platform/testing/README.md)       | 测试上下文和固定时钟                    |
| ui            | [README](../packages/platform/ui/README.md)            | 基础 Vue 组件与样式                     |

### 工程工具

| 工具               | 文档                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| Architecture Check | [tooling/architecture-check](../tooling/architecture-check/README.md) |
| Edition Builder    | [tooling/edition-builder](../tooling/edition-builder/README.md)       |
| OpenAPI Tooling    | [tooling/openapi](../tooling/openapi/README.md)                       |
| Migration CLI      | [tooling/migration](../tooling/migration/README.md)                   |
| Module Generator   | [tooling/module-generator](../tooling/module-generator/README.md)     |

## 就近文档原则

- 系统级不变量写在 `AGENTS.md`、`docs/` 或 ADR。
- Package 的职责、公开 API、依赖和示例写在该 Package 的 `README.md`。
- 只有调用者必须立刻知道的前置条件、失败语义和安全约束才写在代码 TSDoc 中。
- 不在注释中复述实现步骤；注释重点解释“为什么”“边界是什么”“调用者必须保证什么”。
- 修改公开行为时，同一提交必须更新代码、对应 README、系统文档和测试。

## ADR

`docs/adr/` 记录已经做出的重要架构决策。ADR 被接受后不覆写历史；若决策改变，新建 ADR 并标明取代关系。

当前 ADR：

- 0001：使用 Hono
- 0002：使用 Kysely
- 0003：使用 Modular Monolith
- 0004：使用 Server-side Session
- 0005：使用 Module-owned PostgreSQL Schema
- 0006：限制 Elegant Router 为构建期页面注册表
- [0007](./adr/0007-unified-navigation-and-role-grants.md)：统一五类导航节点、数据库布局配置与角色 navigation code 授权
- [0008](./adr/0008-thin-entrypoints-and-owned-workflows.md)：调用式入口、装配与功能流程分离、状态所有权和自动职责检查
- [0009](./adr/0009-openapi-contract-and-soybean-fetch.md)：Zod OpenAPI 单一契约、Scalar 文档与 Soybean Fetch 模块客户端
