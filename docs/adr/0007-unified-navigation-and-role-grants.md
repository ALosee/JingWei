# ADR 0007: Unified Navigation Nodes and Role Navigation Grants

- Status: Accepted
- Date: 2026-09-02
- Supersedes: ADR 0006 中 layout 完全由静态定义决定的部分；AGENTS.md 第 6 节旧节点类型。

## Decision

不建立 Route 表。版本化 `navigation.navigation_node` 统一保存 DIRECTORY、GROUP、MENU、PAGE、EXTERNAL_LINK。MENU/PAGE 引用稳定 routeKey，前端通过 PageBinding 和 Elegant Router views 找到组件。数据库保存 path、layout、默认 params/query，不保存组件源码路径。Manifest 的 layout 是默认值，allowedLayouts（省略时只有默认 layout）限制可选范围。

PERMISSION 检查当前用户的活跃角色是否获授节点 code；routeKey 不参与导航授权。`navigation.role_navigation` 由 Navigation 拥有，只保存 IAM role UUID 和本模块稳定 code，不建立跨模块外键。IAM 通过 Public API 返回活跃角色及功能权限判断；导航授权不能授予业务 API Permission。容器无独立授权，有可见后代才保留；禁用祖先禁用整支。

同一版本内 code、routeKey 唯一；多个菜单复用同一路由暂不支持。parentId 是展示/归属关系，不是 Vue Router 嵌套规则。路径使用绝对路径、普通参数和末尾可选参数的安全子集，参数值和 query 存 JSONB 字面量配置，禁止表达式。

草稿可多次保存并以 editRevision 乐观锁保护；已发布版本不可编辑。发布/回滚在事务中锁定 navigation 根并比较预期发布指针，重验配置后切换指针，同时写审计和 outbox。角色授权独立于发布版本，回滚不回滚权限。schemaVersion 表示 DTO 契约，publishedRevision/versionId 表示发布配置；本轮不实现缓存或推送。

匿名 bootstrap 可显式传 tenantCode，否则用部署配置 BOOTSTRAP_TENANT_CODE（默认 default），必须解析为活跃真实租户；已登录请求只使用 Session tenantId。无已发布版本返回可诊断 503，不隐式退回静态配置。初始版本由受控初始化工具写入。

## Consequences

统一存储不意味着 Menu = Vue Route = 功能 Permission。不同节点类型有互斥字段规则，版本化配置和稳定授权身份分离。节点 code 不得重新用于不同授权含义；重命名 code 是新资源，需要重新授权。
