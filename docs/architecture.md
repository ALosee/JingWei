# 经纬企业平台架构基线

状态：Approved Baseline

版本：1.0

经纬（Jingwei）是长期演进的综合企业信息管理平台。本阶段仅建设 Platform Foundation，不实现具体企业业务模块。

## 核心模型

产品组合与授权按固定顺序解析：

```text
Product -> Edition -> Module -> Capability -> Permission -> Data Scope
```

- Edition：客户交付版本，是构建输入，不是菜单配置。
- Module：拥有业务规则、数据、API、UI、迁移和生命周期的垂直切片。
- Capability：模块内部可选能力，并可声明对其他模块的依赖。
- Permission：当前用户可执行的动作。
- Data Scope：用户对数据行的可见/可操作范围。

这些概念不得互相替代。运行时隐藏菜单不等于移除模块，也不等于完成授权；物理裁剪必须让未启用模块的 server、web、migration、permission 和 page chunk 均不进入交付产物。

## 部署与模块通信

V1 是 Modular Monolith：一个主要 Node.js 后端进程与一个 PostgreSQL Database，内部保持严格模块边界。模块通信只允许：

1. Public API：同步查询或必须立即得到结果的验证。
2. Integration Event：跨模块稳定事实，事件带版本。
3. Transactional Outbox：重要事件与业务写入同事务落库，由逻辑独立的后台 worker 投递。

初期不使用消息队列、Redis、Elasticsearch 或微服务。只有 ADR 能证明真实需求后才引入。

## 分层

```text
HTTP API -> Application -> Domain <- Infrastructure
```

Application Use Case 持有事务边界并接收显式 `ApplicationContext`。Domain 不依赖 Web 或数据库技术。Infrastructure 实现 repository、外部 HTTP、Storage 等 port。Hono route 仅承担 adapter 职责。

## 核心技术栈

- Web：Vue 3、TypeScript、Vite、Vue Router、Pinia、Elegant Router。
- Server：Node.js 24 LTS、TypeScript、Hono、`@hono/node-server`、开发 `tsx`、生产 `tsdown`。
- Data：PostgreSQL 18、Kysely、`pg`。
- Contracts：Zod。
- Workspace/Test：pnpm Workspace、Vitest、Playwright。

## 基础设施最小化

本地开发默认只需要 PostgreSQL。对象存储只有实际文件能力出现时才启动；Vue/Hono 开发进程不强制放入 Docker。可观测性从结构化日志、Request ID、错误与审计开始，指标、OpenTelemetry 与分布式追踪后续按需求增加。

## 变更机制

架构基线不是永远冻结，但任何改变核心技术栈、模块边界、认证策略、数据库所有权、导航安全或部署模型的变更必须先创建 ADR，说明 Context、Decision、Alternatives、Consequences。
