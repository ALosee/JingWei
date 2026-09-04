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

- `platform.auth_session` 的安全实现（由 `@jingwei/auth` 拥有）；
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

| Route key     | 页面         | 访问模式               | 要求                 |
| ------------- | ------------ | ---------------------- | -------------------- |
| `iam.login`   | `IamLogin`   | `blank` / PUBLIC       | `iam.authentication` |
| `iam.account` | `IamAccount` | `base` / AUTHENTICATED | `iam.authentication` |

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
├── shared/                    # 登录 Zod schema 和共享 DTO
├── client/                    # Web typed client
├── server/
│   ├── api/routes.ts
│   ├── application/authenticate-user.ts
│   ├── domain/user-status.ts
│   ├── infrastructure/credential-reader.pg.ts
│   ├── public/authorization.ts
│   └── module.ts
└── web/
    ├── pages/                 # 登录/账号页面展示
    ├── composables/use-sign-in.ts # 登录表单状态和提交流程
    └── module.ts              # PageBinding
```

## HTTP API

### `POST /api/v1/iam/sessions`

输入：`tenantCode`、`login`、`password`。登录标识会规范化后查询租户用户，密码由 Argon2id 验证。成功返回 `201`、用户安全视图与 CSRF token，并设置 session/CSRF Cookie。

### `GET /api/v1/iam/session`

恢复当前会话状态。有效会话返回 `200 { authenticated: true, user: { id, tenantId } }`；没有 Cookie、过期或撤销均返回 `200 { authenticated: false }`。匿名状态不是异常，Web 据此决定是否继续调用受保护的 `/navigation/me`。响应不包含原始 session token。

### `DELETE /api/v1/iam/sessions/current`

撤销当前会话、删除两个 Cookie，成功返回 `204`。由于是已认证修改请求，它由平台中间件执行 Origin 和 CSRF 校验。

完整协议见 [HTTP API 手册](../../../docs/http-api.md)。

## 认证流程

```text
tenantCode ──> TenantDirectory
login ───────> CredentialReader ──> 用户状态检查
password ────> PasswordHasher.verify
                       │
                       ▼
                 SessionService.create
                       │
                       ▼
               安全用户视图 + Cookie
```

用户名不存在、密码错误、用户不可用等情况必须使用一致的外部错误，避免账号枚举。原始密码、密码摘要和 session token 不得进入日志/审计/事件。

Web 登录页只调用 `useSignIn()` 绑定字段和提交事件。该 composable 管理 loading、安全错误和成功后的工作区跳转；`login` 与 `enterWorkspace` 以最小端口注入，测试不用建立真实 Cookie 或浏览器全局对象。HTTP/Zod/CSRF 细节仍由 module client 负责，页面不得直接调用 client。结构规则见 [代码职责与入口约束](../../../docs/code-structure.md)。

## Public API

`@jingwei/module-iam/server/public` 导出：

- `AuthorizationEvaluator.evaluate(request)`：输入 AuthContext、capability 和 permission，返回 allow-only 决策及可选数据范围；
- `AuthorizationDecision` / `DataScopeGrant`；
- `DataScopeType`：`ALL`、`ORGANIZATION`、`ORGANIZATION_AND_DESCENDANTS`、`SELF`、`CUSTOM`；
- 认证用例所需的 `CredentialSnapshot` 类型。
- `IamAccess` 与 `createIamAccess(database, registry)`：返回活跃角色、租户活跃角色目录，并校验不带数据范围的功能权限。Navigation 通过它接入真实角色，不读取 IAM 内部表。

授权实现必须合并所有角色授予，不能从菜单推断权限；deny 是默认结果。其他模块只能依赖这个 public 子路径，不能导入 IAM 仓储和表类型。

## 当前实现状态

已经实现认证、Cookie 会话创建/状态恢复/撤销、凭据 PostgreSQL reader，以及供 Navigation 使用的真实 IamAccess。IamAccess 每次查询活跃用户/角色，多角色取并集，不使用 is_super 绕过；requirePermission 先检查 Edition registry/capability，仅处理无 Data Scope 的功能权限。它不等于通用 AuthorizationEvaluator。

角色管理 CRUD、通用权限投影同步、完整 Data Scope evaluator、失败次数/锁定更新、last_login 更新和完整账号资料查询仍是后续工作。开发种子会投影当前 Edition 的功能权限并初始化显式管理员 grant，但不能当作生产权限同步服务。

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
