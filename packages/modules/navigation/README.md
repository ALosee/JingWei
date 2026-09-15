# Navigation 模块

包：`@jingwei/module-navigation`；模块 ID：`navigation`；必需依赖：`iam`。

Navigation 拥有租户导航配置、发布版本和角色导航授权。它将数据库配置与当前 Edition 页面目录校验后，投影为匿名或当前用户可使用的导航。设计依据：[ADR 0007](../../../docs/adr/0007-unified-navigation-and-role-grants.md)。

## 职责边界

本模块负责统一节点配置、目录/分组、内部菜单/隐藏页面、外链、路径与布局、草稿并发保存、发布/回滚、角色 code 授权，以及管理界面。它不拥有 Vue 组件源码、IAM 角色、业务 API 权限定义、数据范围，也不替代 Vue Router。

不建立 Route 表。`routeKey` 引用模块声明的页面能力；Navigation 的 `code` 是稳定授权身份。二者即使恰好同名，也不可互换。

## 节点契约

所有类型共用 `navigation.navigation_node`，但有互斥字段校验。

| 类型          | 展示             | 路由/目标            | 授权                        |
| ------------- | ---------------- | -------------------- | --------------------------- |
| DIRECTORY     | 可折叠目录       | 无                   | 由可见后代推导              |
| GROUP         | 不折叠的分组标题 | 无                   | 由可见后代推导              |
| MENU          | 侧栏菜单项       | 内部页面             | accessMode                  |
| PAGE          | 不出现在侧栏     | 内部页面，可直接访问 | accessMode                  |
| EXTERNAL_LINK | 侧栏外链         | href                 | accessMode，不需要 routeKey |

共享配置 DTO 定义在 [shared/index.ts](./src/shared/index.ts)，数据库使用 snake_case，API 使用 camelCase：

| 字段           | 含义与约束                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| id             | 当前版本中的节点 UUID；不是授权标识，克隆/保存后会重新分配                                                          |
| code           | 稳定导航资源标识；版本内唯一，小写字母开头，支持数字、点、下划线、连字符，最长 120                                  |
| name           | 展示名称，1–200 字符                                                                                                |
| type           | 上表五种类型                                                                                                        |
| parentId       | 同一版本节点 ID 或 null；表达展示归属，不表达 Vue Router 嵌套                                                       |
| status         | ENABLED / DISABLED；禁用祖先使整个分支不可用                                                                        |
| sortOrder      | 同层排序；同值按 code 排序                                                                                          |
| icon           | 完整 iconify 名（如 `lucide:settings`）或 null；仅支持全名，不提供短别名映射；null 时按类型默认，无效名不会渲染图标 |
| routeKey       | MENU/PAGE 必填；当前 Edition 的稳定页面 key                                                                         |
| path           | MENU/PAGE 必填；绝对路径模板，不把 query 拼在此字段                                                                 |
| layout         | MENU/PAGE 必填；base / blank，受 manifest.allowedLayouts 约束                                                       |
| accessMode     | MENU/PAGE/EXTERNAL_LINK 必填；PUBLIC / AUTHENTICATED / PERMISSION                                                   |
| params         | 内部路径的默认参数对象；字符串或数字，不允许表达式                                                                  |
| query          | 内部跳转的默认查询对象；标量、null 或标量数组                                                                       |
| href           | 仅外链使用；HTTPS URL，不含 username/password                                                                       |
| externalTarget | 仅外链使用；SELF / BLANK，BLANK 输出 noopener noreferrer                                                            |

DIRECTORY/GROUP 的路由、布局、外链、accessMode 必须为 null，params/query 必须为空。外链将查询串直接写入 href，不混用内部路由字段。

父节点必须是容器；PAGE 还可以挂在 MENU/PAGE 下，用来表示隐藏详情页的归属。PAGE 不依赖父菜单的授权：自己获授 code 就可以进入；但禁用父节点仍会禁用整个分支。只包含隐藏 PAGE 的容器不会出现在侧栏。

同一版本内，一个 routeKey 只能挂载一次；当前不支持多个菜单共享同一个 routeKey。

## 三种 accessMode

- PUBLIC：无需登录，但页面本身仍必须允许 PUBLIC。
- AUTHENTICATED：只要求有效会话。
- PERMISSION：有效会话 + 用户至少一个活跃角色获授该节点 code。没有 grant 默认不可见。

例如 `external.docs` 是 PERMISSION 外链，角色只需要获得 `external.docs`；不需要 routeKey，也不需要为外链创建功能 Permission。导航只控制入口，不会保护外站资源。

功能权限完全独立。例如授予 `navigation.manage` 这个导航 code 不会自动授予 `navigation.view` 或 `navigation.publish` 功能权限。相同字符串在两种授权关系中也不能混用。

IAM 的 Public API 返回当前活跃角色并判断功能权限，Navigation 不查询 IAM 表。角色 code 授予由本模块 `role_navigation` 表拥有，多个角色取并集；会话中不缓存完整授权。

## 数据所有权与版本

| 表                            | 作用                                                     |
| ----------------------------- | -------------------------------------------------------- |
| navigation.navigation         | 每租户 main 导航根与 published_version_id                |
| navigation.navigation_version | 草稿/已发布快照，revision、edit_revision、auth/home code |
| navigation.navigation_node    | 版本内的全部节点                                         |
| navigation.role_navigation    | tenant + IAM role UUID + navigation code，独立于配置版本 |

模块内复合外键保证 parent、version、根发布指针属于同一 tenant/version/root。role_id 不建立跨 IAM 外键。

`revision` 是租户内版本序号；`editRevision` 是草稿保存的乐观锁；`schemaVersion: 2` 是响应契约版本。三者不是同一概念。已发布快照由数据库 trigger 保护，不能更新或删除。回滚只原子切换发布指针，并重新校验目标快照，不修改历史记录、不回滚角色授权。

修改节点 code 等于创建新的授权资源，需要重新分配。旧 grant 可保留用于历史版本回滚，管理页会显示当前版本中失效的 code 供显式移除。不要把旧 code 复用于不同授权含义。

## 用例与事务

- `ResolveNavigation.bootstrap(tenantId)`：只投影 PUBLIC 节点及必要容器。
- `ResolveNavigation.forUser(context)`：读取活跃角色，合并 code grant，投影用户导航。
- `ManageNavigation.createDraft`：克隆所选版本；没有来源且没有发布版本时使用初始化模板。
- `save`：全量配置替换；先校验，再比较 editRevision 并递增。当前不会持久化语义无效的草稿。
- `validate`：返回 issues；用于检查已保存版本与当前 Edition 是否兼容，不修改配置。
- `publish`：草稿变为不可变发布快照，切换根指针。
- `publish(..., true)`：回滚到曾发布的版本。
- `deleteDraft`：删除未发布草稿；已发布快照受数据库 trigger 保护，不可删除。
- `grantRole`：整组替换角色的 code；比较 expectedCodes，阻止并发覆盖。

Application 通过 NavigationUnitOfWork 开启事务。保存、发布、回滚和授权串行锁住租户导航根；状态/指针变更、Audit、Outbox 共用同一连接，任何一步失败全部回滚。成功操作记录 draft_created、draft_saved、published、rolled_back、role_granted。审计只记录必要的版本、修订号、code，不复制可能敏感的 query/href 原文。

权限：

| 操作                               | 功能权限                            |
| ---------------------------------- | ----------------------------------- |
| 读取管理配置、目录、角色授权；校验 | navigation.view                     |
| 创建/保存草稿、删除草稿            | navigation.manage                   |
| 发布/回滚                          | navigation.publish                  |
| 保存角色导航授权                   | navigation.manage + iam.role.manage |

所有管理接口要求会话；修改请求还要 Origin + CSRF。功能权限由 Manifest 定义，页面授权不能绕过这些检查。

## HTTP 与公开入口

完整输入、响应、冲突和错误码见 [HTTP API 手册](../../../docs/http-api.md#6-navigation-接口)。

匿名 bootstrap 通过 tenantCode 或 BOOTSTRAP_TENANT_CODE 解析真实租户；已登录请求始终使用会话租户。运行时只从数据库读取已发布版本，无版本返回 NAVIGATION_NOT_PUBLISHED/503，不隐式使用静态数据。

`@jingwei/module-navigation/server/public` 导出 NavigationSource 端口、纯初始化模板 createDefaultConfiguration 和受控装配工厂 createNavigationManagement。工厂封装 PostgreSQL store、IAM public service 和事务适配器；用于初始化工具，不允许普通调用方借此绕过 AuthContext/功能权限。

`@jingwei/module-navigation/client` 使用模块 OpenAPI 生成类型封装所有 HTTP 调用，并以模块 Zod schema 验证响应。修改请求的 CSRF 头由 `@jingwei/api-client` 统一添加；管理页面不自行拼装 URL、Cookie 或 SQL。

## 页面与初始化

管理页支持版本查看、创建草稿、节点字段编辑、保存、校验、发布、回滚和角色导航授权。已发布配置只读；发布/回滚/授权需要明确确认。发布后使用“重新进入工作区”刷新投影；本轮没有自动推送、菜单缓存或页签定义。

`NavigationManage.vue` 只保留展示、事件绑定和 controller 组合。网络调用与状态按所有权分在模块自己的 `web/composables/`，不放到 Web 壳或通用 utils：

| Composable                | 职责                                                 |
| ------------------------- | ---------------------------------------------------- |
| `useNavigationManagement` | 装配客户端、确认框与各状态单元，执行首次加载         |
| `useNavigationEditor`     | 本地节点编辑、选中项、JSON 字段、脏状态，不请求 HTTP |
| `useNavigationVersions`   | 版本列表与发布指针，草稿保存/校验/发布/回滚流程      |
| `useRoleNavigationGrants` | 所选/已加载角色、原始与编辑 code 集合，独立授权提交  |
| `useNavigationFeedback`   | 当前管理页的 busy、操作反馈与安全错误映射            |

版本保存返回新的节点 ID，必须接纳服务端快照并按 code 恢复选择。角色授权使用 `expectedCodes`，不能借用版本的 `editRevision`；回滚版本也不能重置角色授权状态。流程通过最小客户端端口注入测试，具体规则见 [代码职责与入口约束](../../../docs/code-structure.md)。

本地执行迁移后运行 `pnpm seed:navigation`（环境变量须显式加载），它只在非生产环境工作，保留已有密码和已发布配置；初始化 development-admin 角色及显式 grants。运行时不会自动 seed。详情见 [迁移工具](../../../tooling/migration/README.md)。

## 测试与扩展检查

纯规则测试覆盖 access/layout 降级、路径冲突、参数、循环、外链、容器裁剪。真实 PostgreSQL 测试覆盖空库迁移、租户隔离、权限/CSRF、并发保存/发布、回滚、已发布不可变以及 Outbox 失败后的整笔回滚。Playwright 覆盖刷新、五类节点展示和编辑器契约。

管理页 controller 测试覆盖无效 JSON 阻止切换、保存后采用新节点 ID、版本并发参数、角色加载失败清理及授权并发比较；它们不替代真实数据库约束测试。

扩展时先更新 shared schema 与校验器，再更新 migration/store/client/UI 和测试。增加页面必须先在所属模块 manifest 和 Web PageBinding 声明；不能直接往数据库写源码路径。路径语法、授权继承或复用 routeKey 的变化都需要明确设计，而非放宽验证。
