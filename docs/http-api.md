# HTTP API 手册

本文描述 Jingwei 当前对外 HTTP 接口的稳定契约。它关注调用方能够观察到的行为；模块内部的用例、仓储与数据库实现，请分别参考对应模块 README 和 [公共 API 参考](./api-reference.md)。

## 1. 基本约定

### 1.1 地址与版本

- 健康检查位于 `/health`，不属于业务 API 版本。
- 业务接口统一使用 `/api/v1` 前缀。
- 模块接口位于 `/api/v1/<module-code>/...`，例如 `/api/v1/iam/sessions`。
- 破坏兼容性的协议变更应进入新的主版本；向响应中添加可选字段通常不需要升级版本。

运行中的 Server 在 `/openapi/v1.json` 提供 OpenAPI 3.1 契约，在 `/docs` 提供 Scalar 交互式文档。字段、参数、响应状态与安全方案以模块 OpenAPI contract 为事实源；本文补充认证流程、业务语义和调用约束。

### 1.2 数据格式

- 请求和响应主体使用 UTF-8 JSON。
- 客户端发送 JSON 时应设置 `Content-Type: application/json`。
- 时间使用 ISO 8601 字符串，服务端持久化和传输均以 UTC 为准。
- ID 是不透明字符串。调用方不得依赖 UUID 的具体版本、长度或排序性质。
- 空集合返回 `[]`，不使用 `null` 代替集合。

### 1.3 请求上下文

服务端会为每个请求建立应用上下文，至少包含：

| 字段        | 含义                     | 来源               |
| ----------- | ------------------------ | ------------------ |
| `requestId` | 一次 HTTP 请求的关联标识 | 请求头或服务端生成 |
| `tenantId`  | 当前租户                 | 已验证会话         |
| `userId`    | 当前用户                 | 已验证会话         |
| `sessionId` | 当前会话                 | 安全 Cookie        |
| `locale`    | 用户语言偏好             | 当前实现使用默认值 |

日志、审计和异常响应应沿用同一个 `requestId`，便于跨层追踪。

## 2. 认证、Cookie 与 CSRF

### 2.1 会话 Cookie

登录成功后服务端写入两个 Cookie：

- 会话 Cookie：保存随机会话令牌，服务端只保存令牌摘要；应使用 `HttpOnly`、`SameSite` 和生产环境 `Secure` 属性。
- CSRF Cookie：保存可由前端读取的 CSRF 令牌，用于双提交校验。

不要把会话令牌保存在 `localStorage`，也不要在日志、错误信息或审计载荷中记录原始令牌。

### 2.2 修改请求的 CSRF 校验

已登录状态下的 `POST`、`PUT`、`PATCH`、`DELETE` 请求应同时满足：

1. 请求来源通过 Origin 校验；
2. CSRF Cookie 存在；
3. 请求头携带同一个 CSRF 值；
4. 会话仍有效且未过期。

当前前端客户端会自动携带 Cookie。新增修改型接口时，模块不能绕过平台层的 CSRF 与会话校验。

`@jingwei/api-client` 会为修改请求自动读取 `jingwei_csrf` Cookie 并写入 `x-csrf-token`；业务模块客户端不得再次解析 Cookie 或手写该 Header。

## 3. 成功与错误响应

### 3.1 成功响应

- 查询成功使用 `200 OK`。
- 创建成功可使用 `201 Created`；当前登录接口即返回 `201 Created`。
- 删除会话成功可返回 `204 No Content` 或稳定的 JSON 结果；调用方不应依赖未声明的响应正文。

### 3.2 错误结构

平台异常会被统一映射为以下结构：

```json
{
  "code": "IAM_INVALID_CREDENTIALS",
  "message": "用户名或密码不正确",
  "details": {},
  "requestId": "019..."
}
```

字段语义：

| 字段        | 稳定性       | 说明                                 |
| ----------- | ------------ | ------------------------------------ |
| `code`      | 稳定         | 程序判断应使用它，不要匹配 `message` |
| `message`   | 面向人       | 可本地化，不保证文字不变             |
| `details`   | 按错误定义   | 只包含可安全暴露给调用方的信息       |
| `requestId` | 每次请求不同 | 用于日志定位和客服排障               |

常见状态码：

| HTTP 状态 | 含义                                             |
| --------- | ------------------------------------------------ |
| `400`     | JSON、字段或业务输入无效                         |
| `401`     | 未登录、会话无效或凭据错误                       |
| `403`     | 已认证但缺少权限，或 CSRF/Origin 校验失败        |
| `404`     | 资源或路由不存在                                 |
| `409`     | 唯一性、状态转换等业务冲突                       |
| `415`     | 请求体的 `Content-Type` 缺失或不受接口支持       |
| `422`     | 请求格式正确，但领域或配置规则校验失败           |
| `500`     | 未预期的服务端错误；响应不得泄露堆栈和数据库细节 |
| `503`     | 当前依赖、租户配置或已发布快照暂不可用           |

## 4. 平台接口

### `GET /health`

用途：进程存活与基础就绪检查。该接口不要求登录，不暴露租户或内部配置。

典型响应：

```json
{
  "status": "ok",
  "edition": "development"
}
```

部署探针只能依赖已记录的字段，不应把健康接口当作诊断信息导出端点。

## 5. IAM 接口

### `POST /api/v1/iam/sessions`

用途：验证用户名和密码并创建会话。

请求：

```json
{
  "tenantCode": "demo",
  "login": "admin",
  "password": "change-me"
}
```

成功返回 `201 Created`，响应包含当前用户的安全视图与 CSRF token，并通过 `Set-Cookie` 写入会话与 CSRF 令牌。密码、密码摘要、原始会话令牌永远不会出现在响应中。

可能错误：

- 输入缺失或格式无效：`400`；
- 用户不存在、被禁用、密码错误：统一返回认证失败，避免用户名枚举；
- 租户不可用：认证失败或服务不可用，具体映射由应用层错误定义决定。

### `GET /api/v1/iam/session`

用途：恢复当前登录状态。Web 应用启动时用它判断 HttpOnly Cookie 对应的会话是否仍可使用。该查询本身允许匿名访问。

行为：

- 会话有效时返回 `200 { "authenticated": true, "user": { "id": "...", "tenantId": "..." } }`；
- 未携带 Cookie、令牌摘要不匹配、会话过期或已撤销时返回 `200 { "authenticated": false }`；
- 不延长会话的规则应由会话服务统一决定，路由不能自行修改。

匿名状态使用正常的 `200`，使 Web 可以先恢复会话状态，再决定是否请求受保护的 `/navigation/me`。它不把 session token 暴露给 JavaScript。

### `DELETE /api/v1/iam/sessions/current`

用途：撤销当前会话并清理客户端 Cookie。

要求：

- 必须通过会话认证；
- 必须通过 CSRF 与 Origin 校验；
- 撤销操作应幂等：重复退出不能恢复或延长任何会话。

## 6. Navigation 接口

所有接口返回 `Cache-Control: no-store`。管理接口按 Session 隔离租户，不能通过 body/query 指定其他 tenantId。节点完整字段见 [Navigation 模块](../packages/modules/navigation/README.md#节点契约)。

### 6.1 `GET /api/v1/navigation/bootstrap?tenantCode=default`

无需登录。读取数据库中真实租户的当前发布版本，只返回 PUBLIC 节点及必要容器。不是静态登录页列表，也不包含产品标识。

- 匿名：tenantCode 可选，省略时用 BOOTSTRAP_TENANT_CODE，默认 default。
- 已认证：始终使用 Session tenantId，即使 query 传入其他 tenantCode。
- 租户不存在/不可用：NAVIGATION_TENANT_UNAVAILABLE/404。
- 没有发布版本：NAVIGATION_NOT_PUBLISHED/503。
- 发布配置与当前 Edition 不兼容：NAVIGATION_CONFIGURATION_INVALID/503。

### 6.2 `GET /api/v1/navigation/me`

必须登录，匿名返回 AUTHENTICATION_REQUIRED/401。Web 先通过 IAM session status 确认会话，再请求本接口。

读取同一发布快照，但返回 PUBLIC、AUTHENTICATED，以及当前用户任一活跃角色获授 code 的 PERMISSION 节点；禁用分支被移除，空容器不显示。结果不是后端 API 的授权凭证。

bootstrap 和 me 共用响应结构（以下仅示例一个登录节点）：

```json
{
  "schemaVersion": 2,
  "versionId": "00000000-0000-7000-8000-000000000100",
  "publishedRevision": 1,
  "authEntryCode": "iam.login",
  "homeCode": null,
  "nodes": [
    {
      "id": "00000000-0000-7000-8000-000000000001",
      "code": "iam.login",
      "name": "登录",
      "parentId": null,
      "type": "PAGE",
      "status": "ENABLED",
      "routeKey": "iam.login",
      "path": "/signin",
      "layout": "blank",
      "icon": null,
      "sortOrder": 0,
      "accessMode": "PUBLIC",
      "href": null,
      "externalTarget": null,
      "params": {},
      "query": {}
    }
  ]
}
```

nodes 是扁平列表，不是嵌套树。parentId 用于菜单展示；MENU/PAGE 才安装内部路由。homeCode 在当前投影不可见时返回 null。schemaVersion 是协议结构版本，publishedRevision 是配置序号。

### 6.3 管理接口总览

下表路径均位于 `/api/v1/navigation`，权限是**功能 Permission**，不是 navigation code。

| 方法与路径                  | 作用                                                 | 功能权限                            |
| --------------------------- | ---------------------------------------------------- | ----------------------------------- |
| GET /admin                  | 当前发布指针与全部版本摘要（无 nodes）               | navigation.view                     |
| GET /catalog                | 当前 Edition route keys、布局/访问模式范围、活跃角色 | navigation.view                     |
| POST /drafts                | 创建草稿，返回 201 + 完整版本                        | navigation.manage                   |
| GET /versions/:id           | 查询完整版本                                         | navigation.view                     |
| PUT /versions/:id           | 整体保存草稿                                         | navigation.manage                   |
| POST /versions/:id/validate | 校验已保存快照，返回 issues                          | navigation.view                     |
| POST /versions/:id/publish  | 发布草稿                                             | navigation.publish                  |
| POST /versions/:id/rollback | 切回曾发布的版本                                     | navigation.publish                  |
| GET /roles/:roleId/grants   | 查询角色导航 code 集合                               | navigation.view                     |
| PUT /roles/:roleId/grants   | 整组替换角色导航 code                                | navigation.manage + iam.role.manage |

所有 POST/PUT 要求合法 Origin 与当前 Session 对应的 CSRF Cookie/Header，包括 validate。未知或其他租户的版本返回 404，不返回其内容。

`GET /admin` 返回 `{ publishedVersionId, versions }`。版本摘要包含 id、revision、editRevision、status、publishedAt、authEntryCode、homeCode。完整版本额外包含 nodes。status 为 DRAFT/PUBLISHED；publishedAt 是 UTC ISO 字符串或 null。

`GET /catalog` 返回：

```json
{
  "routes": [
    {
      "key": "iam.login",
      "layout": "blank",
      "allowedLayouts": ["blank"],
      "allowedAccessModes": ["PUBLIC"]
    }
  ],
  "roles": [
    {
      "id": "00000000-0000-7000-8000-000000000200",
      "code": "development-admin",
      "name": "开发管理员"
    }
  ]
}
```

catalog 是配置候选目录，完整配置仍要通过服务端校验；它不是当前用户获授的导航列表。

### 6.4 创建和保存草稿

创建 body：

```json
{ "sourceVersionId": null }
```

传 UUID 则克隆指定版本；null 则克隆当前发布版本；若从未发布，使用 Edition 初始化模板。克隆分配新节点 ID，但保持稳定 code。不会自动发布。

保存 PUT 是全量替换，不是 patch。body 为：

```ts
{
  expectedEditRevision: number,
  authEntryCode: string,
  homeCode: string | null,
  nodes: NavigationNode[]
}
```

客户端必须提交完整配置，不应把版本对象中的 id/revision/status/publishedAt 一起传入；严格 schema 会拒绝未知字段。保存成功返回完整版本，editRevision 加一，节点 ID 会重新分配，客户端应以返回值替换编辑模型。

语义不合法返回 NAVIGATION_VALIDATION_FAILED/422，details.issues 包含稳定 issue code、可选 nodeId 和安全 message。当前不保存无效草稿。已发布版本返回 NAVIGATION_VERSION_IMMUTABLE/409；修订不匹配返回 NAVIGATION_EDIT_CONFLICT/409。

validate 检查已保存版本，响应 `{ issues: [] }` 表示通过；有 issues 仍是 200，它不保存浏览器未提交的编辑，也不自动发布。

### 6.5 发布和回滚

两个动作使用相同 body：

```json
{
  "expectedEditRevision": 3,
  "expectedPublishedVersionId": "00000000-0000-7000-8000-000000000100"
}
```

首次发布预期指针为 null。publish 只接受 DRAFT；rollback 只接受 PUBLISHED。两者均重验配置与当前 Edition，锁住根指针，并在同一事务写状态/指针、审计和 outbox。

成功返回目标完整发布版本。指针不符返回 NAVIGATION_PUBLISH_CONFLICT/409，编辑修订不符返回 NAVIGATION_EDIT_CONFLICT/409。不能通过自动重试掩盖冲突，应让管理员重新读取差异。

回滚不回滚角色 grant、业务数据或前端代码。已打开浏览器不会自动刷新；下一次 bootstrap/me 读取新指针。

### 6.6 角色导航授权

GET 返回 `{ codes: ["external.docs", "navigation.manage"] }`。PUT body：

```json
{
  "expectedCodes": ["navigation.manage"],
  "codes": ["navigation.manage", "external.docs"]
}
```

expectedCodes 是此前读取的集合，比较时去重并排序；不匹配返回 NAVIGATION_GRANT_CONFLICT/409。

codes 只能是当前发布版本中 PERMISSION 叶节点的 code；DIRECTORY/GROUP 不单独授权。禁用节点可以预先授权，但不会因此变为可用。空数组表示撤销全部导航 grant，需要明确操作。

角色必须是当前租户活跃角色，否则 ROLE_NOT_FOUND/404。非法 code 返回 NAVIGATION_GRANT_INVALID/422。旧版本残留 code 可被 GET 返回供清理，但 PUT 不能重新授予当前版本不存在的 code。

### 6.7 错误码与客户端处理

| Code                                                                               | HTTP                  | 处理                                            |
| ---------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------- |
| INVALID_REQUEST                                                                    | 400                   | 检查 UUID、字段类型和未知字段                   |
| AUTHENTICATION_REQUIRED                                                            | 401                   | 恢复登录                                        |
| PERMISSION_DENIED                                                                  | 403                   | 检查功能角色授权，不要仅检查菜单可见性          |
| NAVIGATION_VERSION_NOT_FOUND / NAVIGATION_NOT_FOUND / ROLE_NOT_FOUND               | 404                   | 刷新当前租户数据                                |
| NAVIGATION_EDIT_CONFLICT / NAVIGATION_PUBLISH_CONFLICT / NAVIGATION_GRANT_CONFLICT | 409                   | 重新加载并人工合并                              |
| NAVIGATION_VERSION_IMMUTABLE / NAVIGATION_VERSION_STATE                            | 409                   | 创建草稿或选择正确状态                          |
| NAVIGATION_VALIDATION_FAILED / NAVIGATION_GRANT_INVALID                            | 422                   | 根据 details/字段修正                           |
| NAVIGATION_NOT_PUBLISHED                                                           | 503，grant 操作为 422 | 初始化或发布首个版本                            |
| NAVIGATION_CONFIGURATION_INVALID                                                   | 503                   | 管理员修复与当前 Edition 不兼容的配置           |
| INTERNAL_ERROR                                                                     | 500                   | 使用 requestId 查服务端日志，不能向用户展示 SQL |

客户端函数与上述接口一一对应，见 `@jingwei/module-navigation/client`。mutation 封装读取可读 CSRF Cookie；浏览器安全常量从 `@jingwei/auth/shared` 导入，避免把 Node 端安全实现打入 Web bundle。

## 7. 调用示例

以下示例假设服务运行在 `http://localhost:3000`：

```bash
curl -i \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -c /tmp/jingwei-cookies.txt \
  -d '{"tenantCode":"demo","login":"admin","password":"change-me"}' \
  http://localhost:3000/api/v1/iam/sessions

curl -i \
  -b /tmp/jingwei-cookies.txt \
  http://localhost:3000/api/v1/navigation/me
```

退出时还要从 `jingwei_csrf` Cookie 中读取 CSRF 值，并放入 `x-csrf-token` 请求头，同时携带 `Origin`。常量以 `@jingwei/auth` 导出为准，不要在业务模块重复硬编码。

## 8. 新增接口检查表

- 路由由模块自己的 `ServerModule.install` 返回，并挂载到模块 basePath。
- URL 使用 `/api/v1/<module-code>` 命名空间。
- 输入在边界处完成解析和验证，不把未经验证的 `unknown` 传给用例。
- 用例接收 `ApplicationContext`，不在深层代码重新解析 Cookie。
- 读写数据时显式携带租户范围。
- 权限在服务端检查；隐藏菜单不是授权措施。
- 修改请求接入 CSRF、Origin 和会话保护。
- 错误使用稳定 code，经统一错误处理中间件输出。
- 敏感字段不进入响应、日志、审计或 outbox。
- 为成功、未认证、无权限、输入无效和关键冲突补测试。
- 同步更新模块 README、本手册和模块自己的 typed client。
