# `@jingwei/web`

Jingwei 的 Vue 3 Web 壳应用。它负责启动 Pinia 和 Router、恢复导航、安装 Edition 页面并在启动失败时进入可用的恢复界面。

Web 构建通过 `unocss/vite` 扫描壳与各模块页面，`src/bootstrap/start-web.ts` 统一加载生成样式。
`uno.config.ts` 使用 `@soybeanjs/ui-uno` 的 `presetSbean()` 读取根 `sbean.json`，并由
`@soybeanjs/theme` 生成亮色、暗色、语义颜色、圆角和尺寸变量。组件和页面直接使用 Soybean
主题语义，不另建一套 CSS 变量。

`App.vue` 挂载上游 `SConfigProvider`，负责运行时主题和本地持久化；`ThemeSettings`
在所有路由提供统一设置入口。Vite 将上游 `createThemeInitScript()` 注入 HTML head，
在应用加载前恢复明暗模式。完整颜色和尺寸在 Provider 挂载时恢复。
UnoCSS 同时扫描上游已发布组件中的工具类，并使用 `presetSoybean` 补齐布局快捷类。
SoybeanUI 0.30.0 缺少 JS 副作用声明，构建对其 dist JS 做限定的 tree shaking；CSS 保留，
设置器单独分包按需加载。升级时必须复核此规则和主题浏览器测试。

## 职责边界

本应用负责：

- 创建 Vue、Pinia 和 Router 实例；
- 调用 Navigation 模块获取匿名和已认证导航；
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
├── bootstrap/start-web.ts     # Vue/Pinia/Router 与实际依赖装配
├── navigation/
│   ├── initialize-navigation.ts # 导航启动流程与失败恢复
│   └── initial-location.ts   # 纯首屏目标选择
├── generated/modules.ts       # Edition Builder 生成的 Web Module 列表
├── router/
│   ├── _generated/            # Elegant Router 生成
│   ├── dynamic-routes.ts      # 导航节点到真实页面的桥接
│   └── index.ts              # createApplicationRouter 工厂
├── stores/shell.ts            # 最小全局壳状态
├── main.ts                    # 只调用 startWebApplication
└── App.vue
e2e/                           # Playwright 关键路径测试
```

`src/generated` 和 `src/router/_generated` 都是工具产物。修改来源定义或生成配置，不要直接编辑生成文件。

## 启动流程

`main.ts` 只导入并调用 `startWebApplication()`；`bootstrap/start-web.ts` 负责依赖装配与挂载，`initializeNavigation()` 负责下面的导航流程，`selectInitialLocation()` 负责首屏策略。不能把流程分支重新堆进入口或装配文件，依据见 [代码职责与入口约束](../../docs/code-structure.md)。

1. 安装 Pinia 和基础 Router；
2. 请求 `/api/v1/navigation/bootstrap`；
3. 安装匿名可见动态路由；
4. 请求 `/api/v1/iam/session` 恢复 HttpOnly Cookie 的会话状态；
5. 仅在已认证时请求 `/api/v1/navigation/me` 并安装用户可见路由；
6. 保存完整 navigation 投影（含 versionId/publishedRevision）；
7. 重新匹配浏览器最初 URL，确保刷新动态地址不会停在静态 catch-all；
8. 根地址优先使用可见 homeCode，再选首个非公开 MENU；匿名使用 authEntryCode，否则进入恢复页；
9. Router ready 后挂载应用。

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
- `bootstrapError`：启动恢复所需的安全错误文字。

业务实体状态应留在对应模块的 store/composable 中，避免 Web 壳逐渐变成新的业务单体。

## Layout 模型

Route Definition 只允许两种页面外部结构：

| Layout                  | 结构                                                               | 适合页面                                                   |
| ----------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `base` / `BaseLayout`   | 标准企业工作区；当前实现 header + sidebar + content，tabs 暂未实现 | 组织、字典、导航管理、个人账号和普通业务页面               |
| `blank` / `BlankLayout` | 只有 `RouterView`，页面完全拥有 DOM、尺寸和视觉结构                | 登录、密码重置、MFA、SSO、错误页、大屏、地图和沉浸式编辑器 |

应用和浏览器 viewport 本身已经占满屏幕，是否隐藏工作区 chrome 才是布局的实际差异。因此不再为 `fullscreen` 建立一个仅增加 `min-height: 100vh` 的独立概念。认证页面也使用 `blank`；多个认证页面若需要共享品牌或表单结构，应抽取普通 Vue 组件，而不是扩展 Router Layout 种类。

NavigationTree 递归显示 DIRECTORY（可折叠）、GROUP（分组标题）、MENU 与 EXTERNAL_LINK；PAGE 不显示。MENU 使用 navigationTarget 生成默认参数跳转，刷新时保留浏览器实际 URL。外链 BLANK 添加 noopener noreferrer。

动态安装按 layout 分组；parentId 不决定 RouterView 嵌套。每次安装替换全部旧动态路由，而不是持续追加。布局由数据库配置，但必须处于 Manifest.allowedLayouts 中；省略列表时只允许默认值。

导航管理页面属于 Navigation 模块，不放在壳内。它支持草稿编辑、发布/回滚和角色 code 授权；当前不实现缓存、推送或页签状态，发布后需重新进入工作区读取新配置。

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
- 修改请求必须使用平台 CSRF 头名和 Cookie；
- 页面错误不得展示内部堆栈或敏感响应；
- 恢复页应始终能在模块初始化失败时加载。
