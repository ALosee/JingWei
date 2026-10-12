# `@jingwei/web`

Jingwei 的 Vue 3 Web 壳应用。它在同一套制品中按 URL namespace 启动平台控制面或租户工作空间；租户端负责恢复动态导航和 Edition 页面，平台端使用独立会话与静态管理路由。

Web 构建通过 `unocss/vite` 扫描壳与各模块页面，`src/bootstrap/start-web.ts` 统一加载生成样式。
`uno.config.ts` 使用 `@vean/unocss` 的 `presetVean()` 读取 `packages/platform/ui/vean.json`，并由
`@vean/theme` 生成亮色、暗色、语义颜色、圆角和尺寸变量。组件和页面直接使用 Vean
主题语义，不另建一套 CSS 变量。
UnoCSS 通过 `@jingwei/ui/theme-unocss` 保留语义色透明度，并与 `bg-card/40` 等工具类
的透明度相乘；直接使用语义色的 body 也读取同一透明度变量。
构建配置显式使用 Vean 原生语义颜色映射，避免开发配置重载后残留旧的透明度表达式；
透明度在 UnoCSS 替换占位符后组合，主题适配源码也列为配置重载依赖。

`TenantApp.vue` 挂载 `@jingwei/ui` 源码拥有的 `ConfigProvider`，运行时完整色阶、明暗语义色和圆角来自租户
Branding；`PlatformApp.vue` 使用固定平台主题，且不读取租户配置。Base 工作区的
`GlobalSettingsPopover` 在统一区域组合界面密度与布局设置，并以无蒙层的非模态 Popover 呈现。
明暗模式使用 Header 独立图标按钮，默认跟随系统，每次点击按“跟随系统 -> 白天 -> 黑夜 -> 跟随系统”循环。
恢复默认设置会重置密度和个人布局覆盖，明暗模式由 Header 独立控制。
Vite 将最小明暗模式脚本注入 HTML head，在租户应用加载前恢复用户模式提示；完整租户主题与界面
尺寸在 Provider 挂载前由组合根解析。平台路径跳过该提示脚本。
UnoCSS 扫描 `@jingwei/ui` 的本地 Vue/TS 源码，并使用 `presetSoybean` 补齐布局快捷类。
Web 不依赖 `@vean/ui` styled 包。升级生成源码时必须复核
组件 diff 和主题浏览器测试。

## 职责边界

本应用负责：

- 创建 Vue、Pinia 和 Router 实例；
- `/platform/*` 选择固定品牌的平台控制面启动流程；
- 调用 Navigation 模块获取匿名和已认证导航；
- 并行加载生效租户品牌，并投影到 document metadata、favicon 和工作区 chrome；
- 将生效品牌的视觉主题和工作区默认值与当前用户稀疏偏好组合；
- 把服务端返回的 route key 映射到构建期页面注册表；
- 加载布局、通用外壳和恢复页面；
- 保存全局壳状态，例如导航版本和启动错误；
- 提供生产构建与 Playwright E2E 入口。

本应用不负责：

- 在壳层实现模块业务页面；
- 自行裁决用户权限；
- 维护手写的全量模块路由；
- 在组件中直接访问其他模块内部代码。

## 目录

```text
src/
├── bootstrap/start-web.ts     # 按 URL namespace 选择启动流程
├── bootstrap/start-platform-web.ts # 平台 operator 会话与静态路由装配
├── bootstrap/start-tenant-web.ts   # 租户品牌、导航与 IAM 会话装配
├── appearance/                # Branding 到主题的适配与首屏明暗模式脚本
├── branding/document-brand.ts # 生效品牌到浏览器文档 metadata 的投影
├── layouts/
│   ├── BaseLayout.vue         # 组合源码拥有的 AppShell 与工作区状态
│   └── base/
│       ├── use-workspace-navigation.ts # 导航树、当前 PAGE 与手机抽屉状态
│       ├── use-workspace-tabs.ts # 页签集合、具体 URL 与关闭策略
│       └── modules/           # global-brand/header/settings 分模块实现
├── navigation/
│   ├── initialize-navigation.ts # 导航启动流程与失败恢复
│   └── initial-location.ts   # 纯首屏目标选择
├── generated/modules.ts       # Edition Builder 生成的 Web Module 列表
├── router/
│   ├── _generated/            # Elegant Router 生成
│   ├── dynamic-routes.ts      # 导航节点到真实页面的桥接
│   ├── platform-router.ts     # /platform 固定管理路由
│   └── index.ts              # createApplicationRouter 工厂
├── stores/
│   ├── appearance.ts          # tenant+user 范围的明暗与尺寸偏好
│   ├── shell.ts               # 导航与当前会话用户投影
│   └── layout.ts              # 租户默认值与 tenant+user 稀疏布局覆盖
├── main.ts                    # 只调用 startWebApplication
├── TenantApp.vue              # 租户主题根节点
└── PlatformApp.vue            # 固定平台主题根节点
e2e/                           # Playwright 关键路径测试
```

`src/generated` 和 `src/router/_generated` 都是工具产物。修改来源定义或生成配置，不要直接编辑生成文件。

## 启动流程

`main.ts` 只导入并调用 `startWebApplication()`；`bootstrap/start-web.ts` 以精确 path segment 判断入口，并通过动态 import 只加载平台或租户组合根。`/platform` 不执行、也不静态拉入租户品牌、导航或 IAM session 启动图；`/platform-foo` 仍属于租户侧。其他路径由 `start-tenant-web.ts` 装配，`initializeNavigation()` 负责下面的租户导航流程，`selectInitialLocation()` 负责首屏策略。不能根据 Cookie 猜测用户想进入哪个入口，依据见 [代码职责与入口约束](../../docs/code-structure.md)。

1. 安装 Pinia 和基础 Router；
2. 从显式 `tenantCode` query 或最近一次成功登录记录选择匿名租户提示，并与导航流程并行请求 `/api/v1/branding/bootstrap`；SVG Logo 在进入全局品牌状态前再次校验，
   品牌或素材失败时保留内置默认/安全回退展示；成功时同时设置租户主题与工作区默认值；
3. 携带同一租户提示请求 `/api/v1/navigation/bootstrap`；提示租户不可用时回退到部署默认租户；
4. 安装匿名可见动态路由；
5. 请求 `/api/v1/iam/session` 恢复 HttpOnly Cookie 的会话状态；
6. 仅在已认证时请求 `/api/v1/navigation/me` 并安装用户可见路由；
7. 保存完整 navigation 投影（含 versionId/publishedRevision）；
8. 重新匹配浏览器最初 URL，确保刷新动态地址不会停在静态 catch-all；
9. 根地址优先使用可见 homeCode，再选首个非公开 MENU；匿名使用 authEntryCode，否则进入恢复页；
10. 已登录时按 tenantId/userId 加载用户明暗、尺寸和稀疏布局覆盖；匿名状态只使用租户默认值；
11. 应用品牌到登录页、工作区和 document，Router ready 后挂载应用。

导航初始化阶段抛错会记录 `bootstrapError` 并进入 `/__recovery`。Vue 创建、Router 创建或最终挂载本身的异常不属于导航恢复边界。

`initializeNavigation` 只依赖显式注入的加载、路由操作和壳状态端口；其单元测试不需要浏览器。Router 也通过工厂创建，导入 `router/index.ts` 不会立即访问浏览器 history 或创建全局路由实例。

## 动态路由的三方一致性

一条动态路由只有同时满足以下条件才可安装：

| 来源                   | 提供内容                                                      |
| ---------------------- | ------------------------------------------------------------- |
| 服务端 Navigation 响应 | 当前用户可见节点、`routeKey`、path、layout、默认 params/query |
| Module manifest        | 默认/允许布局、允许访问模式、capability/permission 元数据     |
| Web Module `pages`     | `routeKey` 到具体 `pageKey` 的绑定                            |

如果 Edition 中缺少定义或页面绑定，`installDynamicRoutes` 会快速失败并进入恢复页。不能用“找不到页面时静默跳过”掩盖构建不一致。

## 全局状态

`useShellStore` 只保存跨模块壳状态：

- `navigation`：当前完整导航投影，包含版本、入口和节点；
- `currentUser`：Session API 返回的当前用户安全展示投影；
- `bootstrapError`：启动恢复所需的安全错误文字。

`useAppearanceStore` 按 tenantId/userId 保存明暗模式和界面尺寸。缺少当前账号的专属记录时使用
平台默认值，不自动读取无法归属到当前账号的旧版全局主题，避免同一浏览器切换账号时泄漏偏好。
首屏明暗提示是独立的临时显示提示，不作为账号偏好的迁移来源；用户保存的旧调色板、语义色或圆角
也不会覆盖租户品牌。

`useLayoutStore` 接收 Branding 发布的 `base` 工作区默认值，并按 tenantId/userId 只保存用户实际
覆盖的模式、侧栏样式、品牌位置、区域尺寸、页签可见性和 Sider 收缩状态。有效值按“平台回退值 -> 租户默认值
-> 用户稀疏覆盖”合并；恢复默认会删除覆盖，因此租户后续发布的新默认值能作用于未自定义字段。
持久化读取会校验枚举、修复缺失字段和限制尺寸范围。

业务实体状态应留在对应模块的 store/composable 中，避免 Web 壳逐渐变成新的业务单体。

## Layout 模型

Route Definition 只允许两种页面外部结构：

| Layout                  | 结构                                                                            | 适合页面                                                   |
| ----------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `base` / `BaseLayout`   | 标准企业工作区；内部支持六种原生菜单模式，并提供 Header、页签与独立滚动 Content | 组织、字典、导航管理、个人账号和普通业务页面               |
| `blank` / `BlankLayout` | 只有 `RouterView`，页面完全拥有 DOM、尺寸和视觉结构                             | 登录、密码重置、MFA、SSO、错误页、大屏、地图和沉浸式编辑器 |

应用和浏览器 viewport 本身已经占满屏幕，是否隐藏工作区 chrome 才是布局的实际差异。因此不再为 `fullscreen` 建立一个仅增加 `min-height: 100vh` 的独立概念。认证页面也使用 `blank`；多个认证页面若需要共享品牌或表单结构，应抽取普通 Vue 组件，而不是扩展 Router Layout 种类。

`base` 使用 `@jingwei/ui` 源码拥有的 AppShell。六种桌面菜单模式为左侧完整树、顶部完整树、
双列侧栏、侧栏一级与顶部子菜单、顶部一级与侧栏子菜单，以及顶部一级与双列侧栏。
历史配置 `left` 映射到 AppShell 的 `sidebar`，其余模式使用原生名称；这些模式不扩展 Router Layout。
骨架、区域挂载、侧栏收缩和菜单渲染器由 AppShell 管理，应用不再维护菜单模式组件注册表或 Teleport 挂载点。
左侧模式使用原生的全高侧栏；品牌移入顶栏也不改变骨架。混合模式宽度随原生导航栏位计算，
只有单侧栏模式使用用户或租户配置的侧栏宽度。品牌的 mark/title 分别通过原生槽位注入，收缩后保留完整标志并居中。
工作区设置沿用分区缩略图卡片，六种模式各自绘制不同的导航区域，并按三列两行展示。
顶部菜单模式隐藏侧边栏宽度和品牌位置设置，切回其他布局时恢复对应控件与已保存偏好。
侧栏样式直接使用原生 `sidebar`、`floating`、`inset` variant，个人设置、租户默认和品牌实时预览同步支持。
平台默认品牌位置为侧栏顶部，也可选择顶栏或侧栏底部。底部位置仅在左侧菜单和双列侧栏中可选；
其他桌面模式使用原生回退位置，同时保留偏好以便切回原模式恢复。已有租户发布版本和个人覆盖保留原值。

`navigation/app-shell-items.ts` 将当前用户已获授权的投影转换为一棵完整输入树：DIRECTORY/GROUP 保留
层级，MENU 使用 `navigationTarget` 生成默认参数跳转，外链保留 HTTPS、target 和安全链接语义；
PAGE 保留在原父子位置并标记 `hidden`。父节点未获授的 PAGE 以隐藏根节点保留，不补造未授权祖先。
当前路由的 navigation code 直接绑定 AppShell 的 modelValue，原生面包屑因而能显示隐藏 PAGE；
菜单和祖先下拉过滤 hidden 项。原生祖先下拉的目标投影补齐 to/href 等链接字段，避免重复手工路由跳转。
PAGE 路由通过 TreeMenu 公开的受控展开 API 保持可见祖先展开，不改变面包屑生成或菜单实现。
面包屑可见区域遵循原生模式规则：顶部及部分混合模式的 Header 用于菜单，不另外增加面包屑区域。

手机视图统一使用 AppShell 的完整树菜单抽屉，品牌位于抽屉内；桌面收缩偏好与临时 mobileOpen 分开。
内部导航成功后关闭抽屉，刷新默认关闭；顶部菜单在桌面保留 hover、键盘与溢出“更多”。
菜单搜索、全屏、用户账号和非模态设置通过 Header trailing slot 组合。

`use-workspace-tabs` 拥有稳定的响应式页签数组，以具体 route.path 为身份，并记录最后的 query/hash。
当前导航版本的首页通过 `homeCode`（含默认 params/query）解析，始终在最左侧固定且不可关闭、拖动。
原生 PageTabs 负责选择、关闭、中键与键盘交互，以及固定分组内的拖拽排序。右键提供关闭、关闭其他、
关闭左侧、关闭右侧、关闭所有和固定/取消固定；批量关闭保留首页和固定页签，首页不能取消固定。
`modules/workspace-tabs/WorkspaceTabs.vue` 通过 AppShell 的 tabs slot 组合原生 PageTabs、溢出时的左右
滚动按钮和页面操作。原生页签视口负责自动滚动到当前项及滚轮横向滚动，按钮不随页签溢出。
标签栏右侧刷新按钮重新挂载当前页面，重新执行页面加载且保留 URL、页签顺序和固定状态。
页面全屏使用 Layout 的 `fullContent`，隐藏侧栏与 Header，仅显示标签栏和 Content；退出恢复原布局偏好，
切换时不重新挂载页面，也不调用浏览器全屏 API。隐藏标签栏不销毁集合。
浏览器刷新通过 `workspace-tab-session.ts` 恢复同一浏览器标签页内的工作区。版本化 `sessionStorage`
按 tenantId/userId 隔离，保存打开顺序、用户固定状态及各页最后的具体 URL（含 query/hash），不保存页面组件或表单数据。
恢复时用当前已授权导航与已安装的 base 路由重新校验，过滤失效、无权限、身份变更、不安全和重复的标签；
标题从当前导航读取，首页仍按当前版本重新生成。导航新版保留仍然有效的标签，浏览器当前 URL 决定选中项，
不会被历史缓存跳转覆盖。关闭、固定和拖拽变更即时保存；缓存损坏或浏览器禁止存储时回退到内存状态。
不做 KeepAlive、页面缓存或跨窗口同步；结束浏览器页面会话后不保证在新窗口恢复。
租户主题在 blank 页面仍由 ConfigProvider 应用，设置入口只属于 BaseLayout。
设计取舍见 [ADR 0023](../../docs/adr/0023-use-native-app-shell.md) 和 [ADR 0024](../../docs/adr/0024-restore-workspace-tabs-per-browser-session.md)。

动态安装按 layout 分组；parentId 不决定 RouterView 嵌套。每次安装替换全部旧动态路由，而不是持续追加。布局由数据库配置，但必须处于 Manifest.allowedLayouts 中；省略列表时只允许默认值。

导航管理页面属于 Navigation 模块，不放在壳内。它支持草稿编辑、发布/回滚和角色 code 授权；当前不实现导航缓存或推送，发布后需重新进入工作区读取新配置。

## 开发与验证

```bash
pnpm --filter @jingwei/web dev
pnpm --filter @jingwei/web dev:test
pnpm --filter @jingwei/web build
pnpm --filter @jingwei/web preview
PLAYWRIGHT_CHANNEL=chrome pnpm --filter @jingwei/web test:e2e
```

Web 的 Vite `envDir` 指向仓库根目录。`dev` 使用 `development` mode，`dev:test` 使用 `test` mode；只有 `VITE_` 前缀的变量会暴露给浏览器代码，数据库连接等服务端 Secret 不会进入前端环境。

构建脚本先运行 Elegant Router 生成，再执行 Vite。Edition 生成由根级构建流程负责。

## 新增页面

1. 在业务模块 manifest 中添加 route definition；
2. 在模块 `web.ts`/`web/module.ts` 添加 PageBinding；
3. 添加模块自己的 Vue 页面，网络流程与提交状态放在模块 `web/composables/`，页面负责展示和绑定；
4. 确保页面 key 被 Elegant Router/页面注册表识别；
5. 在 Navigation 草稿中添加 MENU/PAGE，配置路径与布局，校验后发布；
6. 为匿名、已登录和无权限情况补测试；
7. 构建目标 Edition，验证缺失绑定会被发现。

## 安全说明

- 服务端返回的导航是展示模型，不是接口授权凭证；
- Cookie 由浏览器携带，前端不读取会话原始令牌；
- 修改请求必须通过平台 API client 自动附加 CSRF Cookie/Header，不在页面或模块 client 重复读取 Cookie；
- 页面错误不得展示内部堆栈或敏感响应；
- 恢复页应始终能在模块初始化失败时加载。
