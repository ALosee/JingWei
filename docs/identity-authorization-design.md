# Identity & Authorization Design

## 身份模型

V1 中一个 User 属于一个 Tenant；同一自然人在不同 Tenant 可以拥有不同 User。未来若出现一次登录切换多个租户的明确需求，再通过 ADR 引入 Global Identity。

`User != Employee`。User 是系统登录身份；Employee 是未来 HR 业务实体。Organization 只管理组织、岗位和用户关系，不拥有工资、入职、劳动合同、考勤或绩效。

## Authentication

- Argon2id 密码散列，参数集中配置。
- Server-side Session + HttpOnly Cookie；raw token 至少 256-bit CSPRNG，只在 Cookie 中出现，数据库保存 SHA-256 hash。
- Session 同时有 idle/absolute expiry，支持 logout、管理员 revoke、改密/禁用后的全部 revoke。
- Production Cookie：HttpOnly、Secure、SameSite=Lax、Path=/。
- unsafe methods 执行 Origin Validation 与 CSRF Protection。业务代码只读取 AuthContext，不读取 Cookie。

## Organization

`organization.org_unit` 使用 adjacency list (`parent_id`) 与 PostgreSQL Recursive CTE；V1 不使用 closure table、nested set、ltree。一个 Tenant 可有多个 root。User 可属于多个 Organization、拥有多个 Position；最多各一个 primary。Position 是具体组织岗位，不等同未来 HR Job/Job Family。

## RBAC 与数据范围

- Permission 定义来自 Module Manifest，数据库 `iam.permission_definition` 是 Edition projection。
- 命名为 `<module>.<action>`；disabled module 的 permission projection 可保留但不得生效。
- V1：User -> Role -> Permission，Allow-only，无 direct user permission、无 explicit deny；多个角色取并集。
- Data Scope：ALL、ORGANIZATION、ORGANIZATION_AND_DESCENDANTS、SELF、CUSTOM；功能 permission 与 scope 分离，多角色 scope 取并集，任一 ALL 直接得到 ALL。

授权 pipeline：

```text
Authentication -> Tenant -> Module/Capability -> Permission -> Data Scope -> Application -> Repository
```

Session 只证明“谁登录了”，不持久化完整 role/permission/scope；授权读取当前状态，V1 不引入 Redis permission cache。Tenant Admin 不能跨 Tenant；未来 Platform Operator 必须使用独立 backoffice 安全域。

## 导航授权是独立资源

Navigation 的 PERMISSION 模式表示 User -> 活跃 Role -> navigation code。Navigation 拥有 role_navigation，IAM 只提供角色身份/状态的 Public API；外链无 routeKey 也可以按 code 授权。

功能权限和导航权限不能相互推导。授予导航入口不能授予 navigation.publish 等 API 操作；同名字符串也属于不同授权关系。多个角色的导航 code 取并集，容器只按后代可见性显示，不独立授予权限。详情见 [导航设计](./navigation-routing-design.md#5-rbac角色获授-navigation-code)。

当前 IAM 已提供 IamAccess，实时查询活跃用户/角色并校验不带数据范围的功能权限；不使用 is_super 通配。完整 AuthorizationEvaluator/Data Scope 执行器仍待实现，不能据此宣称所有业务数据范围已受保护。
