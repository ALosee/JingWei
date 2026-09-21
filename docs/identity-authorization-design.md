# Identity & Authorization Design

## 身份模型

V1 中一个 User 属于一个 Tenant；同一自然人在不同 Tenant 可以拥有不同 User。未来若出现一次登录切换多个租户的明确需求，再通过 ADR 引入 Global Identity。

`User != Employee`。User 是系统登录身份；Employee 是未来 HR 业务实体。Organization 只管理组织、岗位和用户关系，不拥有工资、入职、劳动合同、考勤或绩效。

## Authentication

- Argon2id 密码散列，参数集中配置。
- Web 使用服务端 opaque Access/Refresh Token Family；两个 raw token 均为至少 256-bit CSPRNG，只在 HttpOnly Cookie 中出现，数据库保存 SHA-256 hash。
- Access Token 默认 10 分钟；Refresh Token 每次使用后轮换，Family 同时有 30 分钟 idle 和 7 天 absolute expiry，支持 logout、管理员 revoke、改密/禁用后的全部 revoke。
- Production Cookie：HttpOnly、Secure、SameSite=Strict、host-only。Access Path=/；Refresh Path=/api/v1/iam/sessions/refresh。
- unsafe methods 执行 Origin Validation 与 CSRF Protection。刷新端点即使 Access 已过期也必须校验 CSRF。业务代码只读取 AuthContext，不读取 Cookie。
- 连续密码失败默认 5 次后锁定 15 分钟，计数与锁定由 IAM 在 PostgreSQL 原子更新；未知租户/账号同样执行 dummy Argon2id 校验，所有认证失败保持相同外部响应。
- 成功登录、退出与 Refresh Token 复用写入 append-only 安全审计；审计和结构化日志都禁止保存密码、原始 token 或完整凭据请求。
- 浏览器可以把最近一次成功认证的 tenant code 保存为下一次登录提示，并在退出 URL 中携带；该值不是身份或授权依据，失败登录不得更新它，服务端仍以重新认证后的 Session tenantId 为准。
- 密码、微信、OIDC 等是认证方式；Web Cookie、未来 Public Client Bearer 与 Machine Token 是凭证传输方式。二者不在 IAM Domain 中耦合。

## Organization

`organization.org_unit` 使用 adjacency list (`parent_id`) 与 PostgreSQL Recursive CTE；V1 不使用 closure table、nested set、ltree。一个 Tenant 可有多个 root。User 可属于多个 Organization、拥有多个 Position；最多各一个 primary（数据库 partial unique index 强制）。Position 是具体组织岗位，不等同未来 HR Job/Job Family。V1 岗位分配仅允许该组织下的岗位。Organization 通过 `OrganizationMembershipQuery` 暴露用户所属组织，供 Data Scope 执行器使用；授权决策仍归 IAM。

## RBAC 与数据范围

- Permission 定义来自 Module Manifest，数据库 `iam.permission_definition` 是 Edition projection。
- 命名为 `<module>.<action>`；disabled module 的 permission projection 可保留但不得生效。
- V1：User -> Role -> Permission，Allow-only，无 direct user permission、无 explicit deny；多个角色取并集。
- Data Scope：ALL、ORGANIZATION、ORGANIZATION_AND_DESCENDANTS、SELF、CUSTOM；功能 permission 与 scope 分离，多角色 scope 取并集，任一 ALL 直接得到 ALL。

授权 pipeline：

```text
Authentication -> Tenant -> Module/Capability -> Permission -> Data Scope -> Application -> Repository
```

Token Family 只证明“谁登录了”，不持久化完整 role/permission/scope；授权读取当前状态，V1 不引入 Redis session/permission cache。Access 与 Refresh 都实时经过活动租户门禁，暂停或停用租户会同时批量撤销其 Token Family。Tenant Admin 不能跨 Tenant。

Platform Operator 使用独立 backoffice 安全域：`/platform/login`、`control_plane.*` 表、`jingwei_platform_*` Cookie、CSRF Header 和 `PlatformAuthContext` 都不复用租户 IAM。平台页面是固定静态路由，不进入租户 Navigation 或 Branding；平台动作写入 PLATFORM scope 审计。首位 operator 由一次性 CLI 初始化，日常租户管理通过 `/platform/tenants` 完成。V1 不提供平台 operator RBAC 或跨租户业务数据浏览。

## 导航授权是独立资源

Navigation 的 PERMISSION 模式表示 User -> 活跃 Role -> navigation code。Navigation 拥有 role_navigation，IAM 只提供角色身份/状态的 Public API；外链无 routeKey 也可以按 code 授权。

功能权限和导航权限不能相互推导。授予导航入口不能授予 navigation.publish 等 API 操作；同名字符串也属于不同授权关系。多个角色的导航 code 取并集，容器只按后代可见性显示，不独立授予权限。详情见 [导航设计](./navigation-routing-design.md#5-rbac角色获授-navigation-code)。

当前 IAM 已提供两个不可混用的授权入口：`IamAccess.requireUnscopedPermission` 只校验无数据范围的功能权限，误传 scoped permission 会抛出明确的编程错误；`AuthorizationEvaluator.requireScopedPermission` 只处理带范围权限，成功时必定返回非空 `DataScopeGrant`，拒绝直接抛出 403。两者都实时查询活跃用户/角色，不使用 is_super 通配。Evaluator 实现多角色 scope 并集、任一 ALL 直接 ALL，组织范围经 Organization 提供的 `OrganizationalScopeFacts` 展开（成员组织 + 后代，CUSTOM 取角色配置的组织并在保存及求值时按当前租户与启用状态校验；无效 ID fail closed）。Permission 以 `dataScope.allowedTypes` 和 provider 描述能力；Organization 的 `organization.view` 不允许 SELF。受限组织树由 Repository 按 `organizationIds` 查询目标节点及祖先，岗位/成员详情要求目标组织落在 scope 内；写操作走无数据范围的 `organization.manage`。事实适配器由 Edition Composition Root 显式注入，IAM-only Edition 不创建 Organization 端口。业务模块若要按数据范围过滤，应在 Application 层把 scope 转换为本模块查询条件并下推 Repository，不能先读取全量数据再在内存过滤，也不能让 Repository 依赖 IAM 类型。

## HTTP 授权契约

每个 OpenAPI operation 必须通过 `createApiRoute` 显式声明 `PUBLIC`、
`AUTHENTICATED`、`REFRESH_TOKEN`、`PLATFORM_AUTHENTICATED`、`PLATFORM_REFRESH_TOKEN` 或 `PERMISSION`。功能权限契约同时声明 capability、
permission 和 scoped/unscoped 入口，并以 `x-jingwei-authorization` 写入 OpenAPI。Server 在
完成模块装配后使用当前 Edition Registry 校验全部 `/api/v1` 契约；架构检查禁止模块绕过
授权契约工厂。

功能权限 requirement 由 Owner Module 定义为不可变对象，Application 授权调用与 OpenAPI
共同引用；跨模块 requirement 只能通过 Owner Module Public API 使用。启动校验负责契约结构、
Manifest、Capability 和 scope mode 的一致性，不声称能够静态推导任意 Application 控制流。

该契约用于文档、启动校验和测试，不替代 Application 授权。接口路径和 HTTP method 不是
权限身份；多个接口可以继续共享稳定的业务 permission，需要独立控制时再由 Owner Module
增加新的业务权限。详见 [ADR 0015](./adr/0015-declare-http-authorization-contracts.md)。
