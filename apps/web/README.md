# `@jingwei/web`

Jingwei 的 Vue 3 Web 壳应用。它在同一套制品中按 URL namespace 启动平台控制面或租户工作空间；租户端负责恢复动态导航和 Edition 页面，平台端使用独立会话与静态管理路由。

Web 构建通过 `unocss/vite` 扫描壳与各模块页面，`src/bootstrap/start-web.ts` 统一加载生成样式。
`uno.config.ts` 使用 `@soybeanjs/ui-uno` 的 `presetSbean()` 读取 `packages/platform/ui/sbean.json`，并由
`@soybeanjs/theme` 生成亮色、暗色、语义颜色、圆角和尺寸变量。组件和页面直接使用 Soybean
主题语义，不另建一套 CSS 变量。

`TenantApp.vue` 挂载 `@jingwei/ui` 源码拥有的 `ConfigProvider`，运行时完整色阶、明暗语义色和圆角来自租户
Branding；`PlatformApp.vue` 使用固定平台主题，且不读取租户配置。Base 工作区的
`GlobalSettingsPopover` 组合用户外观偏好与布局设置，并以无蒙层的非模态 Popover 呈现。
Vite 将最小明暗模式脚本注入 HTML head，在租户应用加载前恢复用户模式提示；完整租户主题与界面
尺寸在 Provider 挂载前由组合根解析。平台路径跳过该提示脚本。
UnoCSS 扫描 `@jingwei/ui` 的本地 Vue/TS 源码，并使用 `presetSoybean` 补齐布局快捷类。
Web 不依赖 `@soybeanjs/ui` styled 包。升级生成源码时必须复核
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
│   ├── BaseLayout.vue         # 只组合 Headless Layout 与当前模式定义
│   └── base/
│       ├── layout-mode-registry.ts # 模式到菜单、Header 内容与几何策略的注册表
│       └── modules/           # global-brand/header/menu/settings/tab 分模块实现
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
覆盖的模式、品牌位置、区域尺寸、页签可见性和 Sider 收缩状态。有效值按“平台回退值 -> 租户默认值
-> 用户稀疏覆盖”合并；恢复默认会删除覆盖，因此租户后续发布的新默认值能作用于未自定义字段。
持久化读取会校验枚举、修复缺失字段和限制尺寸范围。

业务实体状态应留在对应模块的 store/composable 中，避免 Web 壳逐渐变成新的业务单体。

## Layout 模型

Route Definition 只允许两种页面外部结构：

| Layout                  | 结构                                                                                | 适合页面                                                   |
| ----------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `base` / `BaseLayout`   | 标准企业工作区；内部可切换左侧菜单或顶部菜单，并提供 Header、页签与独立滚动 Content | 组织、字典、导航管理、个人账号和普通业务页面               |
| `blank` / `BlankLayout` | 只有 `RouterView`，页面完全拥有 DOM、尺寸和视觉结构                                 | 登录、密码重置、MFA、SSO、错误页、大屏、地图和沉浸式编辑器 |

应用和浏览器 viewport 本身已经占满屏幕，是否隐藏工作区 chrome 才是布局的实际差异。因此不再为 `fullscreen` 建立一个仅增加 `min-height: 100vh` 的独立概念。认证页面也使用 `blank`；多个认证页面若需要共享品牌或表单结构，应抽取普通 Vue 组件，而不是扩展 Router Layout 种类。

`base` 内部的左侧/顶部菜单由租户提供默认值，用户可在自己的浏览器中覆盖；它不扩展 Navigation
或 Manifest 的 layout 枚举。
工作区基于 `@jingwei/ui` 的 Soybean Headless Layout 包装，使用 `scrollBehavior=content` 保证页面
滚动不带动 Header 和 Sider。左侧模式且品牌位于 Header 时使用纵向外层布局，使 Header 横跨
Sider 与 Content；品牌位于 Sider 时切换为横向外层布局。顶部模式不渲染 Sider。

布局模式由 `layout-mode-registry.ts` 注册菜单组件、Header 上下文组件、Sider 可见性和几何策略，
`BaseLayout` 只通过动态组件消费定义。新增混合模式时增加定义与对应模块，不扩展 `v-if/else`
分支链。各菜单区域提供稳定挂载点；`SiderGlobalMenu` 和 `HeaderGlobalMenu` 分别通过 Teleport
投放 Soybean Headless TreeMenu 与 Menubar，布局骨架不拥有菜单实现。

菜单数据转换层显示 DIRECTORY、GROUP、MENU 与 EXTERNAL_LINK，PAGE 不显示；当前 PAGE 会向上
解析到最近的可见 MENU，以保持 TreeMenu 展开和选中状态。MENU 使用 `navigationTarget` 生成默认
参数跳转，刷新时保留浏览器实际 URL；外链由共享 Link 语义补齐安全属性。Header 在左侧模式使用
Soybean Headless Breadcrumb，在顶部模式承载 Menubar；页签使用 PageTabs；菜单搜索和设置使用
非模态 Popover；全屏能力使用 VueUse。

页签记录当前 BaseLayout 生命周期内访问过的具体 fullPath，支持切换和关闭；刷新只恢复当前页，
本期不做 KeepAlive、页面状态缓存和跨窗口页签同步。租户主题在 blank 页面仍由 ConfigProvider 应用，
但设置入口只属于 BaseLayout，避免破坏 blank 页面完全拥有结构的约定。

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
