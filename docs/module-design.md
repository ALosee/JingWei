# Module Design

Module 是拥有业务语义、数据、API、UI、Migration 与生命周期的边界，不是技术工具或页面分类。

## Manifest

`defineModule()` 的纯 metadata 至少包含：`id`、`name`、`category`、required/optional dependencies、capabilities、permissions、routeDefinitions。Capability 可以声明 `requiresModules`；Route Definition 必须声明稳定 `routeKey`、page key、layout 与 `allowedAccessModes`。

构建时验证重复模块/permission/route、缺失依赖、循环依赖、非法 Capability 组合与 Route 安全声明。Manifest 不读取 env、DB，也不 import Vue component 或 server service。

## Server slice

- `domain`：Entity、Value Object、Domain Rule/Event；只依赖本模块或稳定 kernel。
- `application`：Use Case、repository port、事务、跨模块 Public API port、事件发布。
- `infrastructure`：Kysely repository、外部适配器。
- `public`：其他 Module 可依赖的稳定 query/snapshot/event contract。
- `api`：Hono sub-app、Zod validator、presenter。

`server/module.ts` 和公开的 create-* 工厂是装配边界，只连接上述实现，不内联 HTTP handler 或 SQL。Application 通过端口获得最小依赖，不能接收 Runtime 后自行查找服务；模块不能直接读取 process.env。入口导入不触发运行期 I/O。

跨模块 command 应谨慎；如果 B 模块不存在时 A 仍应成立，优先由 A 发布 Integration Event，让 B 自己响应。

## Web slice

`pages/` 是 Elegant Router 唯一扫描的模块页面目录。模块 web metadata 将稳定 routeKey 映射到 build-time page key；运行时 URL、name、parent、type/status、layout 来自 Navigation，不从文件路径推导。layout 与访问模式受模块静态允许列表限制。

`pages/` 保留模板、展示 computed、DOM 交互和 controller 绑定。模块自有 `composables/` 拥有请求编排、提交状态与失败处理，并调用 `client/` 的 typed API；页面不直接导入 client 或拼装 HTTP。按独立状态所有权拆分，例如导航节点编辑、版本操作、角色授权，而不是把所有逻辑机械搬到一个 usePage 中。

这些规则由 `architecture:check` 的入口、装配、分层、页面规则辅助检查；边界与例外详见 [代码职责约束](./code-structure.md) 和 [ADR 0008](./adr/0008-thin-entrypoints-and-owned-workflows.md)。

## 数据与事件

模块只能直接读写自己的 PostgreSQL Schema。对外返回 snapshot/contract，不暴露 repository、Kysely query、database row 或可变 domain entity。

Domain Event 只表达模块内部事实；Integration Event 是明确发布的稳定跨模块契约，事件名和 payload 带版本，例如 `contract.approved.v1`。Breaking change 发布 v2，不静默修改 v1。

## README 与验收

每个 Module README 必须说明 Responsibility、Owned Data、Public API、required/optional dependencies、capabilities、permissions、published/consumed events 和关键规则。新 Module 至少具备 manifest、README、owned migrations、显式 exports、tenant isolation、authorization/audit 决策、测试并通过 Full Edition build。
