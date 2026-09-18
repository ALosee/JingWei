# `@jingwei/ui`

Jingwei Web 的源码级 UI 基础。它使用 Soybean 的 headless、theme、UnoCSS recipe 和生成器，
但不依赖 `@soybeanjs/ui` styled 包；组件实现、样式、Provider 和公开 API 都由本仓库控制。

## 目录与所有权

```text
src/
├── components/                 # sbean 管理的无业务基础组件及其依赖
│   └── <component>/            # 上游原生小写目录、完整组件族、types/context/index
├── styles/                     # sbean 生成的组件 recipe
├── theme/                      # 本地主题状态、Provider 配套与首屏恢复
├── patterns/                   # Jingwei 自有的跨模块通用组合组件
│   └── theme-settings-panel/
├── index.ts                    # 唯一公共入口，向业务导出无 S 前缀名称
└── theme.css                   # 浏览器级全局样式
```

组件归属按语义而不是按“是否可复用一次”判断：

- 无业务词汇、跨模块共享的基础组件放 `@jingwei/ui/src/components`；
- 组合多个基础组件形成的跨模块通用模式放 `@jingwei/ui/src/patterns`；
- “组织选择器”“角色授权面板”等业务组件放所有者模块的 `src/web/components`；
- 只属于应用外壳的品牌、导航、顶栏和设置等按职责放在
  `apps/web/src/layouts/base/modules/<module>`。

业务模块只能从 `@jingwei/ui` 公共入口导入共享 UI，不能跨包引用其 `src`。模块业务组件
可以直接引用本模块的 composable/client，但网络流程仍应由 composable/controller 拥有。

## 公开 API

`components` 内保留 sbean 生成的 `SButton`、`SInput` 等上游命名，以便升级时直接比较；
`src/index.ts` 在包边界导出 `Button`、`Input`、`InputNumber`、`Textarea`、`Switch`、`Segment`、`Select`、
`Slider`、`Separator`、`Dialog`、`Layout`、`Tabs`、`Tree`、`TreeMenu`、`Menubar`、`Breadcrumb`、`Popover`、
`PageTabs`、`ConfigProvider` 等简洁名称。不要为了改名去修改生成文件，也不要在业务代码中使用内部 `S*` 名称。

`ThemeSettingsPanel`（上游 ThemeCustomizer 源码移植，保持唯一 headless + 本地 styled 源码）是本地 `patterns`，不由 sbean 管理。它提供完整主题定制：显示模式、调色板、
配色方案、尺寸/圆角、高级层级与 Custom 逐 token 调色。`palette-picker` / `theme-mode-select` 为
pattern 内私有实现。设置入口、非模态容器和工作区文案由 Web 壳拥有。新增公开组件时同步更新显式
export、README 和相应契约测试。

## 新增或更新组件

在仓库根执行：

```bash
pnpm ui:inspect input
pnpm ui:add input
pnpm ui:diff input
```

- `ui:inspect` 只预览将写入的文件和依赖；
- `ui:add` 将组件族及缺少的依赖直接生成到本包的原生目录；
- `ui:diff` 用于组件已存在时比较本地源码与当前固定版本模板。

配置位于本包的 `sbean.json`，CLI 的 cwd 也固定到本包，因此不需要再移动文件、改 alias
或手工拼接依赖。生成结果属于本仓库源码：提交前要 review diff，保留有意的本地修改，
并为可回归的交互补测试。当前 sbean 0.30.0 可能输出 `ui/theme` registry warning；只要
预览/生成的目标均位于本包且质量门禁通过，该警告不要求人工重排目录。

生成代码使用 `#ui/*` 私有 alias。它只在本包 `package.json#imports` 和 tsconfig 中解析，
不会成为对外 export。为兼容上游 Vue prop spread 的可选属性表达，本包局部关闭
`exactOptionalPropertyTypes`；`strict` 与仓库其他严格检查仍保持开启。不要在生成文件中
通过 `any`、`@ts-ignore`、`eslint-disable` 或 `as unknown as` 规避类型问题。
包的 `types` export 指向稳定的 `public.d.ts` 门面，避免业务包用自己的编译选项重复检查
UI 实现；每个新增公共组件都必须同步补齐该门面，防止运行时 export 与消费者类型漂移。

## Headless 与主题边界

- `@soybeanjs/headless` 负责 ARIA、键盘、焦点和受控状态；
- 本地 styled 源码负责 DOM 组合、API、UnoCSS recipe 和视觉表现；
- `@soybeanjs/theme` 提供语义 token、主题生成、持久化与首屏脚本；
- `@soybeanjs/ui-uno` 在 Web 构建时生成默认 token 和 reset；
- `@soybeanjs/ui` 是禁止依赖，`pnpm architecture:check` 会拦截 package dependency 和源码 import。

`Layout` 基于 headless LayoutCompact，公开受控 Sider、区域尺寸、独立 Content 滚动、移动端和
Header/Tab/Content slots；`LayoutTrigger` 复用同一个上下文。`Tabs`、`TreeMenu`、`Menubar`、
`Breadcrumb`、`Popover` 与 `PageTabs` 分别包装对应的 Soybean Headless Compact/primitive，保留
其 WAI-ARIA、键盘、焦点、受控状态和浮层定位语义，本包只负责公共 API 与 UnoCSS recipe。
应用只从本包公共入口使用它们。

Web 根节点挂载本地 `ConfigProvider` 并启用 `persist-theme`。Provider 同时装配本地 Toast、
Dialog 和 Progress provider；`useTheme()` 复用同一个上下文，不另建 Pinia 主题 store。
`ThemeSettingsPanel` 提供浅色/深色/跟随系统、中性色、品牌色、圆角、尺寸和恢复默认，设置
保存在当前浏览器；Web 壳决定如何呈现设置入口。`@jingwei/ui/theme-init` 在应用加载前恢复
明暗模式，避免首屏闪烁。

## 组件完成要求

- 使用语义化 HTML，并验证标签、键盘、焦点、disabled/loading/error 等相关状态；
- props、events、slots 与受控/非受控状态清晰，基础组件不读取业务 store 或调用 API；
- 样式使用语义 token 和可静态扫描的完整 UnoCSS class；
- 不为单一页面样式过早加入平台层，不建立 `common`/`misc` 垃圾桶；
- 运行仓库 `AGENTS.md` 要求的完整质量门禁。
