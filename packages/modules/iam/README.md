# IAM 模块

包：`@jingwei/module-iam`；模块 ID：`iam`；类别：`foundation`。

IAM（Identity and Access Management）拥有用户身份、凭据、角色、权限授予和数据范围，是其他受保护模块建立主体身份与授权决策的基础。

## 职责与非职责

IAM 负责：

- 租户内用户账号与登录标识；
- 密码凭据状态和认证用例；
- 角色、用户角色分配和权限授予；
- 权限定义投影；
- 组织数据范围授权的表达；
- 登录、会话恢复和退出 HTTP 接口；
- 向其他模块提供最小授权端口。

IAM 不负责：

- `platform.auth_session` / `platform.auth_refresh_token` 的安全实现（由 `@jingwei/auth` 拥有）；
- 员工档案、劳动关系和 HR 职务；
- 组织树（由 Organization 拥有）；
- 菜单是否展示（由 Navigation 解析）；
- 仅靠页面可见性实施授权。

## Manifest

### 能力

| Capability           | 含义                       |
| -------------------- | -------------------------- |
| `iam.authentication` | 用户认证、会话入口和账号页 |
| `iam.authorization`  | 角色与权限管理能力         |

### 权限

`iam.user.view`、`iam.user.manage`、`iam.role.view`、`iam.role.manage`。当前均不声明组织数据范围；未来改变时要同步授权 evaluator、迁移与安全测试。

### 页面路由

| Route key     | 页面         | 访问模式               | 要求                                   |
| ------------- | ------------ | ---------------------- | -------------------------------------- |
| `iam.login`   | `IamLogin`   | `blank` / PUBLIC       | `iam.authentication`                   |
| `iam.account` | `IamAccount` | `base` / AUTHENTICATED | `iam.authentication`                   |
| `iam.roles`   | `IamRoles`   | `base` / PERMISSION    | `iam.authorization` + `iam.role.view`  |
| `iam.users`   | `IamUsers`   | `base` / PERMISSION    | `iam.authentication` + `iam.user.view` |

IAM 没有必需业务模块依赖，因此是多个 foundation 模块的依赖根。

## 数据所有权

| 表                              | 用途                           | 关键约束                                |
| ------------------------------- | ------------------------------ | --------------------------------------- |
| `iam.user`                      | 租户用户身份                   | tenant + normalized username/email 唯一 |
| `iam.user_credential`           | 密码摘要、失败次数、锁定       | user 一对一，级联删除                   |
| `iam.role`                      | 租户角色                       | tenant + code 唯一                      |
| `iam.user_role`                 | 用户角色分配                   | tenant/user/role 复合主键               |
| `iam.permission_definition`     | 模块 manifest 权限的运行时投影 | permission code 全局主键                |
| `iam.role_permission`           | 角色权限与 scope type          | role/permission 复合主键                |
| `iam.role_permission_org_scope` | 自定义组织范围                 | role/permission/org 复合主键            |

IAM 不直接拥有会话表。Organization 的 org ID 作为跨模块标识保存，不建立跨模块数据库外键，避免破坏模块独立演进。

## 代码结构

```text
src/
├── manifest.ts
├── shared/                    # 登录/账号/角色 Zod schema 和共享 DTO
├── client/                    # Web typed client
├── server/
│   ├── api/routes.ts
│   ├── application/authenticate-user.ts
│   ├── application/session-lifecycle.ts
│   ├── application/manage-roles.ts
│   ├── application/manage-users.ts
│   ├── application/permission-catalog.ts
│   ├── domain/user-status.ts
│   ├── infrastructure/credential-reader.pg.ts # 凭据状态读写适配器
│   ├── infrastructure/role-store.pg.ts
│   ├── infrastructure/user-admin-store.pg.ts
│   ├── infrastructure/permission-projection.pg.ts
│   ├── public/authorization.ts
│   └── module.ts
└── web/
    ├── pages/                 # 登录/账号/角色/用户管理页面展示
    ├── composables/use-sign-in.ts # 登录表单状态和提交流程
    ├── composables/use-iam-role-management.ts
    ├── composables/use-iam-user-management.ts
    └── module.ts              # PageBinding
```

## HTTP API

### `POST /api/v1/iam/sessions`

输入：`tenantCode`、`login`、`password`。登录标识会规范化后查询租户用户，密码由 Argon2id 验证。成功返回 `201`、用户安全视图与会话有效期，并设置 access/refresh/CSRF Cookie。认证响应不返回任何原始认证 token。

### `GET /api/v1/iam/session`

恢复当前 Access Token 状态。有效 token 返回当前用户安全展示投影 `{ id, tenantId, displayName, avatarUrl }`；读取按 tenantId 与 userId 限定且只接受活跃用户。没有 Cookie、过期、撤销或用户不再活跃均返回 `200 { authenticated: false }`。Web 客户端可先尝试一次 Refresh Cookie 轮换，再决定是否调用受保护的 `/navigation/me`。

### `POST /api/v1/iam/sessions/refresh`

使用仅匹配本端点的 HttpOnly Refresh Cookie，并要求 Origin、CSRF Cookie/Header。成功原子消费旧 refresh generation，返回 `200` 会话有效期并重新设置 access/refresh Cookie；并发轮换返回 `409`；无效、过期、复用或已撤销返回 `401`。

### `DELETE /api/v1/iam/sessions/current`

撤销当前 token family、删除 access/refresh/CSRF 三个 Cookie，成功返回 `204`。由于是已认证修改请求，它由平台中间件执行 Origin 和 CSRF 校验。

### `GET /api/v1/iam/account`

读取当前会话用户本人的账号资料投影（用户名、显示名、邮箱、手机、头像、状态、最近登录、创建时间、密码最近修改时间）。不接受调用方指定的用户 id。

### `PATCH /api/v1/iam/account`

更新当前用户的显示名与头像 URL，成功返回更新后的资料。要求 Origin 与 CSRF。

### `POST /api/v1/iam/account/password`

校验当前密码后写入新摘要，并撤销该用户全部会话（含当前会话）。成功返回 `204`；客户端应引导重新登录。

### `GET /api/v1/iam/account/roles`

返回当前用户已分配且状态为 ACTIVE 的角色列表。

### `GET /api/v1/iam/roles`

读取当前租户角色列表，含分配人数。要求 `iam.role.view`。

### `POST /api/v1/iam/roles`

创建角色。`code` 租户内唯一且创建后不可改。要求 `iam.role.manage`。

### `GET /api/v1/iam/roles/:roleId`

读取角色详情。要求 `iam.role.view`。

### `PATCH /api/v1/iam/roles/:roleId`

更新名称、描述与状态。要求 `iam.role.manage`。

### `DELETE /api/v1/iam/roles/:roleId`

删除角色。系统角色或仍有用户分配的角色不能删除。要求 `iam.role.manage`。

### `GET /api/v1/iam/permissions`

返回当前 Edition 可分配的功能权限目录（来自 Module Registry）。要求 `iam.role.view`。

### `GET /api/v1/iam/roles/:roleId/permissions`

读取角色已获授的权限与数据范围。要求 `iam.role.view`。

### `PUT /api/v1/iam/roles/:roleId/permissions`

整组替换角色权限。权限必须存在于当前 Edition；不支持数据范围的权限只能使用 `ALL`。要求 `iam.role.manage`。

### `GET /api/v1/iam/users`

读取租户用户列表。要求 `iam.user.view`。

### `POST /api/v1/iam/users`

创建用户。用户名租户内唯一；可带初始密码与角色。要求 `iam.user.manage`。

### `GET /api/v1/iam/users/:userId`

读取用户详情。要求 `iam.user.view`。

### `PATCH /api/v1/iam/users/:userId`

更新资料或状态。禁用会撤销全部会话；不能禁用自己或最后一个管理员。要求 `iam.user.manage`。

### `POST /api/v1/iam/users/:userId/password`

管理员重置密码并撤销该用户全部会话。要求 `iam.user.manage`。

### `GET /api/v1/iam/users/:userId/roles`

读取用户角色分配。要求 `iam.user.view`。

### `PUT /api/v1/iam/users/:userId/roles`

整组替换用户角色。要求 `iam.user.manage`。

完整协议见 [HTTP API 手册](../../../docs/http-api.md)。

## 认证流程

```text
tenantCode ──> TenantDirectory
login ───────> CredentialStore ──> 用户状态/锁定检查
password ────> PasswordHasher.verify ──> 失败计数/成功时间
                       │
                       ▼
                 SessionService.create
                       │
                       ▼
          opaque Access/Refresh + CSRF Cookie
```

用户名不存在、密码错误、用户不可用和账号锁定必须使用一致的外部错误；未知用户也执行一次 dummy Argon2id 校验，降低基于响应耗时的账号枚举风险。默认连续失败 5 次锁定 15 分钟；成功登录原子清零失败状态、更新 `last_login_at` 并写入安全审计。退出和 Refresh Token 复用同样写入审计。原始密码、密码摘要、access/refresh token 不得进入日志、审计或事件。

Web 登录页只调用 `useSignIn()` 绑定字段和提交事件。登录 client 使用 Soybean Fetch 扁平结果，composable 显式判断 `error`，无需异常控制流；`submitting` 由共享 `useApiRequestState()` 订阅 Fetch lifecycle 自动产生，不手工切换。`login` 与 `enterWorkspace` 以最小端口注入，测试不用建立真实 Cookie 或浏览器全局对象。HTTP/OpenAPI/Zod 细节由 module client 负责，Cookie、CSRF 与请求状态由平台请求边界负责，页面不得直接调用 client。结构规则见 [代码职责与入口约束](../../../docs/code-structure.md)。

## Public API

`@jingwei/module-iam/server/public` 导出：

- `AuthorizationEvaluator.requireScopedPermission(request)`：只接受声明了 Data Scope 的权限；授权成功返回非空 `DataScopeGrant`，拒绝直接抛出 `PERMISSION_DENIED`；
- `DataScopeGrant`；
- `DataScopeType`：`ALL`、`ORGANIZATION`、`ORGANIZATION_AND_DESCENDANTS`、`SELF`、`CUSTOM`；
- `OrganizationalScopeFacts`：IAM 消费方定义的组织事实契约，只包含成员组织、后代展开和当前租户有效 ID 校验；具体适配器由 Organization 提供并在 Edition Composition Root 注入；
- `IamAccess` 与 `createIamAccess(database, registry)`：返回活跃角色、租户活跃角色目录，并通过 `requireUnscopedPermission` 校验不带数据范围的功能权限。若误传 scoped permission，会抛出 `AUTHZ_SCOPE_PERMISSION_REQUIRES_EVALUATOR`，而不是伪装成普通授权拒绝。Navigation 通过它接入真实角色，不读取 IAM 内部表；
- `IamUserDirectory` / `IamUserSafeProfile` 与 `createIamUserDirectory(database)`：跨模块安全用户查找（`findSafeProfiles`、`usersExist`）。Organization 用它水合成员列表并校验 user id，不读取 IAM 表，不暴露凭据字段。

授权实现必须合并所有角色授予，不能从菜单推断权限；deny 是默认结果。其他模块只能依赖这个 public 子路径，不能导入 IAM 仓储和表类型。

## 当前实现状态

已经实现认证、登录失败计数/临时锁定/成功时间更新、opaque Access/Refresh Token Family 创建/状态恢复/轮换/复用检测/撤销、凭据 PostgreSQL store，以及供 Navigation 使用的真实 IamAccess。IamAccess 每次查询活跃用户/角色，多角色取并集，不使用 is_super 绕过；`requireUnscopedPermission` 先检查 Edition registry/capability，并拒绝 scoped permission。`AuthorizationEvaluator.requireScopedPermission` 只处理带 Data Scope 的权限，成功结果保证包含显式范围；两个入口通过命名和运行时错误共同防止混用。

无范围权限判断和有效权限目录使用 tenant-scoped join 一次读取活跃用户、角色与 grant；
带范围判断同样一次读取活跃 grant，仅 CUSTOM 追加组织引用查询。每次授权评估记录结构化
`durationMs`、permission、evaluator 与 outcome：正常结果为 debug，慢于 50ms 或执行失败为
warn。无效 CUSTOM 历史引用继续 fail closed；数据库或事实适配器故障保留内部错误路径，
不再伪装成普通 403。

角色管理（CRUD、权限目录、整组替换授权）与用户管理（列表、创建、资料/状态更新、重置密码、角色分配）及对应管理页已实现。授权展示与校验以 Module Registry 为 Source of Truth；`iam.permission_definition` 仍可由 seed/运维投影，但服务端安装不再强制写库。Permission 通过 `dataScope.allowedTypes` 精确声明可选范围，Organization 的查看权限不提供 `SELF`。完整 Data Scope evaluator 已实现并被 Organization 读路径使用；CUSTOM ID 在保存时校验，并在求值时按当前租户再次校验，失效、停用或跨租户 ID 会令授权 fail closed。启用 Organization 时，Edition 生成代码显式注入服务端事实适配器和 Web `CustomScopeReferenceDirectory`；IAM-only Edition 不保留组织运行时端口。角色管理员通过专用 scope-options API 读取本租户全部有效组织，不依赖 `organization.view`。邮箱/手机变更与验证码、多设备会话列表仍是后续工作。开发种子会投影当前 Edition 的功能权限并初始化显式管理员 grant，但不能当作生产权限同步服务。

个人账号页已支持资料查看/编辑、修改密码（全会话撤销）和角色只读展示；路由使用 `/account?tab=profile|security|roles`，不引入无意义的 path id。

角色导航授权由 Navigation 拥有的 navigation.role_navigation 保存 role UUID 与 navigation code，不在 IAM 中新建路由/菜单表，不建立跨模块外键。导航 grant 不能授予业务 API 权限；Navigation 的角色授权写接口同时要求 navigation.manage 与 iam.role.manage。

新增这些能力时必须优先补：跨租户隔离、角色合并、数据范围、账户禁用、全部会话撤销和并发登录安全测试。

## 修改检查表

- 用户查询始终包含 tenant；
- 登录错误不泄露用户是否存在；
- 密码和 token 不进入可观测载荷；
- 受保护用例在服务端调用授权 evaluator；
- 新 permission 同步 manifest、投影和测试；
- 修改会话接口验证 Cookie 属性、Origin 与 CSRF；
- 跨模块只扩展最小 public 契约或发布事件；
- 更新 [身份与授权设计](../../../docs/identity-authorization-design.md)。
