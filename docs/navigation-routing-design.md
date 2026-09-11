# 动态导航与路由设计

本文描述已经实现的统一节点模型；关键取舍见 [ADR 0007](./adr/0007-unified-navigation-and-role-grants.md)，字段细节见 [Navigation README](../packages/modules/navigation/README.md)。

## 1. routeKey、code 和组件不是同一件事

| 概念            | 所有者                      | 示例               | 变化影响                    |
| --------------- | --------------------------- | ------------------ | --------------------------- |
| 页面组件        | Module Web                  | IamLogin.vue       | 实现或文件可以重构          |
| pageKey         | Elegant Router 构建注册表   | IamLogin           | PageBinding 映射到组件      |
| routeKey        | Module Manifest             | iam.login          | 稳定页面身份，不随 URL 改变 |
| navigation code | Tenant Navigation           | signin.entry       | 稳定授权资源身份            |
| path            | Tenant Navigation           | /signin            | 当前租户对页面的 URL 编排   |
| 功能 permission | Module Manifest / IAM grant | navigation.publish | 服务端操作权限              |

Elegant Router 的 views key 是组件发现结果，不直接作为数据库授权标识。保持 routeKey → PageBinding.pageKey → views 的映射，可使文件重命名不破坏租户配置和授权。

数据库不需要另一张 Route 表，但仍需要模块代码声明 allowedAccessModes、allowedLayouts、requiredCapability 等安全范围。统一存储不等于把菜单、组件和功能权限合并为一个概念。

## 2. 五种节点

- DIRECTORY：目录，折叠/展开；不占用路由。
- GROUP：分组标题，只分类展示，不提供折叠交互。
- MENU：出现在菜单中的普通内部页面。
- PAGE：不出现在菜单中，但可以安装路由，例如登录、详情页。
- EXTERNAL_LINK：直接跳转 href，不安装 Vue 路由，不需要 routeKey。

容器不能单独设置 accessMode；有可见菜单/外链后代才保留。PAGE 独立做授权，不会因为父菜单未授权而被拒绝；parentId 只表示展示归属。status 是另一条规则：禁用一个节点同时禁用整条后代分支。

MENU/PAGE 使用绝对 path，不将 parentId 自动转换为嵌套路由。实际 Vue Router 只按 base/blank 包装页面；菜单树和组件 RouterView 嵌套树不是同一棵树。

## 3. layout

只保留两种：

- base：标准企业工作区；内部可在左侧树菜单和顶部菜单之间切换，并提供 header、页面标签和独立滚动 content。
- blank：仅 RouterView，页面自行拥有结构。登录、SSO、错误页或沉浸式页面都可以使用它。

Navigation 数据库存储选定 layout；Manifest.layout 是默认值，allowedLayouts 是允许列表。省略 allowedLayouts 表示仅允许默认 layout；不是允许任意布局。目前已有页面均保持各自的默认布局。要允许某页在两种结构间切换，应由页面所有者显式声明并验证 UI 兼容性。

左侧菜单/顶部菜单是 base 壳的本地展示模式，不是新的 Route Layout，不进入数据库和 Manifest。
BaseLayout 使用平台 UI 的 Headless Layout 包装管理区域尺寸、收缩和 content 独立滚动；不同菜单
组件通过 Teleport 投放到 header/sider 的稳定挂载点。

## 4. 路径模板与具体 URL

例如给某个已注册页面配置：

```json
{
  "path": "/account/:id",
  "params": { "id": "123" },
  "query": { "tab": "security", "tag": ["a", "b"] }
}
```

侧栏点击得到 `/account/123?tab=security&tag=a&tag=b`。安装到 Router 的仍是 `/account/:id`，不是这个默认实例。

- params/query 是**默认跳转值**，不是数据权限、输入白名单或服务端 API 参数。
- PAGE 可以不填必需参数的默认值，由调用方提供具体值，例如 router.push({ name: routeKey, params, query })。
- MENU、authEntryCode 和 homeCode 必须能直接生成具体 URL，所以必需 params 不得缺失。
- 页面刷新时保留浏览器当时的 params/query/hash，不用默认值覆盖。
- 查询值支持字符串、数字、布尔、null 和标量数组。null 编码为空值，数组重复同名键。
- params 使用 URL 编码；禁止默认值 "."/".."，避免浏览器将其归一化为路径跳转。
- 当前 path 语法是有意收窄的安全子集：静态 ASCII 段、普通 :name、末尾 :name?。不支持正则、自定义 matcher、重复参数、通配符、表达式、query/hash 内嵌及 /__ 保留前缀。
- 路径冲突按匹配范围保守检查，例如 /account/new 与 /account/:id 不允许同时配置；路径大小写也视为冲突。
- 当前每版本 routeKey 唯一；多菜单复用一个页面需以后另行设计。

外链 query 直接属于 href，禁止同时设置 params/query/path/layout。只接受无内嵌凭据的 HTTPS URL。BLANK 使用 target="_blank" 和 rel="noopener noreferrer"。隐藏外链不能替代外部系统的认证。

## 5. RBAC：角色获授 navigation code

`accessMode=PERMISSION` 的判断式：

```text
当前会话有效
并且 当前用户任一活跃角色的 navigation grants 包含 node.code
```

PUBLIC 不要求登录；AUTHENTICATED 只要求登录。MENU/PAGE 的模式必须在模块允许列表内，不能把受保护页面配置成 PUBLIC。

Navigation 通过 IAM Public API 读取真实活跃角色，再查询自己拥有的 role_navigation。外链与普通菜单完全一样按 code 判断，不存在“必须先有 routeKey 才能授权”的前提。

功能 API 另走 manifest-defined permission。例如用户获授管理页的导航 code，却没有 navigation.view，页面可打开但管理接口返回 PERMISSION_DENIED/403。这是两种资源授权分离后的正常结果。前端只改善体验，后端用例才是安全边界。

多个角色取并集，没有直接用户授权、显式 deny 或 is_super 通配绕过。授权每次请求读取，不存入 Session 快照。

## 6. 为什么仍需要 Version

Version 不是前端代码版本，也不是多余的缓存编号。它保证一次菜单变更是一个可审查、可验证、可回退的完整快照：

1. V1 已发布，所有新导航请求读取 V1。
2. 创建 V2 草稿，修改多个节点；用户仍读取 V1。
3. 保存 V2 使用 editRevision，避免两位管理员相互覆盖。
4. 发布时重新全量校验，并比较 expectedPublishedVersionId；V2 和发布指针在同一事务提交。
5. 发现问题后回滚指针到 V1；V2 保留为历史记录。

| 字段                         | 职责                                         |
| ---------------------------- | -------------------------------------------- |
| schemaVersion                | HTTP 响应结构的版本，目前为 2                |
| versionId                    | 一个配置快照的 UUID                          |
| revision / publishedRevision | 租户内配置序号；草稿创建时分配，回滚可能变小 |
| editRevision                 | 同一草稿每次保存递增的乐观锁                 |
| publishedVersionId           | main 导航根当前指向的快照                    |

发布把已有草稿冻结，不另生成一份重复快照。数据库 trigger 禁止修改/删除发布记录及其节点。草稿保存当前也进行全量语义校验；未完成的无效编辑只留在浏览器中。

回滚重新检查目标快照与**当前 Edition**是否兼容。若旧页面已被裁剪，不允许盲目回滚。回滚不恢复角色 grant、不撤销业务操作、不改变组件代码。

角色授权独立于版本，稳定 code 让普通名称/路径调整不影响授权。删除节点后旧 grant 不生效，但可留待回滚；code 改名需要重新授权，禁止将旧 code 复用于另一种授权含义。

## 7. 运行流程

1. 构建期先生成 Edition Page Registry，只包含启用模块。
2. Web 调用公开 bootstrap，加载已发布配置的 PUBLIC 投影。
3. 调用 IAM session status；匿名不请求 /navigation/me，避免预期内的 401。
4. 有会话才读取 /me；组合 PUBLIC、AUTHENTICATED 与角色获授节点。
5. 用完整投影替换动态路由，删除旧路径和旧授权页面，不只追加。
6. 根据 code 建菜单树，根据 routeKey 找组件，根据数据库 layout 选择外壳。
7. 重新匹配初始具体 URL；根地址使用可见 homeCode，随后回退到首个非公开 MENU；匿名使用 authEntryCode。
8. 加载失败进入独立静态 /__recovery。

bootstrap 不是固定返回登录页：它读取真实租户当前发布快照，并筛选公开节点。匿名 tenantCode 可显式提供，默认 BOOTSTRAP_TENANT_CODE=default；已登录始终使用 Session tenantId。未知租户 404，无发布版本 503。

没有运行时静态配置回退。默认模板只用于受控初始化/创建首个草稿。这样数据库配置失败不会被静态数据掩盖。

## 8. 事务、审计与当前边界

保存、发布、回滚和角色 grant 修改均锁住租户 main 根；写入配置、审计和 outbox 在一个 PostgreSQL 事务中完成。expectedEditRevision、expectedPublishedVersionId、expectedCodes 分别处理三类并发冲突。客户端收到 409 应重新加载，不自动重试覆盖。

本轮没有缓存、ETag、实时推送或页面 keep-alive 定义。BaseLayout 页签只记录当前壳生命周期内访问过的 fullPath，不参与服务端导航版本。接口返回 Cache-Control: no-store；发布或授权后下一次请求生效，已打开浏览器需要刷新。后续可以利用 versionId 做一致性检查，但版本机制本身不依赖缓存。

当前管理能力已落地；IAM 完整角色 CRUD、通用数据范围 evaluator 不属于这次导航实现。细节见 [IAM README](../packages/modules/iam/README.md)。
