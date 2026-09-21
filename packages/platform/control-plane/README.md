# `@jingwei/control-plane`

平台控制面拥有独立的平台管理员身份、会话和租户生命周期 HTTP/UI。它不属于任何租户，也不进入
Edition Module、租户 Navigation、租户 Branding 或租户 IAM 权限图。

## 地址与边界

| 入口                 | 用途                             |
| -------------------- | -------------------------------- |
| `/platform/login`    | 平台管理员登录                   |
| `/platform/tenants`  | 创建、查看、暂停、恢复和停用租户 |
| `/api/v1/platform/*` | 平台控制面 API                   |
| `/signin`            | 普通租户用户登录，不属于本包     |

同一套 Web 制品依据 `/platform` 路径选择平台启动流程，因此内网只使用 `IP:port` 也不需要为每个
租户部署前端。平台页面使用固定品牌和静态路由，不读取租户主题或动态导航。

## 身份与会话

- `control_plane.operator` 和 `operator_credential` 保存最小平台管理员身份与 Argon2id 密码摘要；
- `operator_session` 和 `operator_refresh_token` 使用独立 opaque Access/Refresh Token Family；
- Cookie 使用 `jingwei_platform_*` 名称，不能与租户 `jingwei_access`/`jingwei_refresh` 互换；
- unsafe 请求执行 Origin 和独立 CSRF 校验；禁用 operator 后既有会话 fail closed；
- 平台动作写入 `PLATFORM` scope 审计，不伪造 tenantId 或租户 UserId。
- 登录成功与失败均写 append-only 平台审计；请求 IP/User-Agent 由统一 HTTP 元数据中间件提供。
- `PLATFORM_*` 授权契约只能出现在 `/api/v1/platform`，该命名空间也拒绝租户会话授权契约。

V1 只允许通过一次性运维命令创建首位平台管理员：

```bash
PLATFORM_OPERATOR_PASSWORD='至少十二位的密码' \
  pnpm platform:bootstrap --login platform-admin --name 平台管理员
```

数据库中已有任何 operator 后，该命令会拒绝再次执行。日常租户管理通过页面完成，旧
`tenant:manage` 只保留作灾备工具。

## 租户创建

页面提交后按顺序保留租户、初始化 IAM 管理员与角色、发布默认 Navigation、授予导航入口，最后
把租户切换为 `ACTIVE`。任一步失败都保留 `PROVISIONING` 和安全错误代码，可从详情页重试。
初始密码仅用于本次初始化，不进入日志或审计。

页面与灾备 CLI 调用同一个 `ProvisionTenant` 用例。初始化按 tenantId 获取 PostgreSQL advisory lock，
同一租户跨进程串行，不同租户仍可并行。IAM/Navigation 通过各自公开 provisioning 端口完成；
控制面不合成租户 session 或 `AuthContext`。初始管理员只获得创建当时 Edition 中允许 `ALL` 的
权限与已发布默认导航入口；以后 Edition 新增权限不会隐式扩大既有角色，需由租户管理员显式授予。

架构决策见 [ADR 0018](../../../docs/adr/0018-separate-platform-control-plane.md)。
