# `@jingwei/ui`

Jingwei Web 的源码级 UI 基础。它使用 Vean 的 headless、theme、UnoCSS recipe 和生成器，
但不依赖 `@vean/ui` styled 包；组件实现、样式、Provider 和公开 API 都由本仓库控制。

## 目录与所有权

```text
src/
├── components/                 # vean 管理的无业务基础组件及其依赖
│   └── <component>/            # 上游原生小写目录、完整组件族、types/context/index
├── styles/                     # vean 生成的组件 recipe
├── theme/                      # 本地主题状态、Provider 配套与首屏恢复
├── patterns/                   # Jingwei 自有的跨模块通用组合组件
│   ├── management-workspace/   # 管理页分栏外壳、列表工具栏与搜索
│   ├── theme-settings-panel/    # 上游主题/色板组件的公开别名
│   ├── theme-palette/          # 受控色阶选择、生成与读取
│   └── theme-scope/            # 不改变全局状态的局部主题预览边界
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

`components` 内保留 vean 生成的 `SButton`、`SInput` 等上游命名，以便升级时直接比较；
`src/index.ts` 在包边界导出 `Button`、`Input`、`InputNumber`、`Textarea`、`Switch`、`Segment`、`Select`、
`Slider`、`Separator`、`SplitterGroup`、`SplitterPanel`、`SplitterResizeHandle`、`Dialog`、`Layout`、`Tabs`、`Tree`、`TreeItem`、`TreeVirtualizer`、`TreeVirtualizerItem`、`TreeMenu`、`TreeNav`、`Menubar`、`Breadcrumb`、`Popover`、
`PageTabs`、`ConfigProvider`、`ThemeModeSegment` 等简洁名称。不要为了改名去修改生成文件，也不要在业务代码中使用内部 `S*` 名称。

`ThemeModeSegment` 使用 Provider 的明暗模式上下文，提供系统、浅色和深色图标选项；
默认隐藏文字但保留无障碍名称，可用 `showLabel` 显示文字。Web 壳负责将上下文模式同步到当前账号的外观偏好。

`ThemeSettingsPanel`（上游 ThemeCustomizer 原生组件族的公共别名）仍作为主题能力参考；`ThemePaletteSelect`、
`PalettePicker` 和色阶生成/读取函数是无存储副作用的受控能力。Branding 在模块内组合色系选择、
语义色阶引用、单色自定义和整套色阶微调；不把租户字段塞进共享 UI 组件。租户产品不直接暴露任意 CSS。
`ThemeScope` 接收受约束主题并生成带唯一 data selector 的局部
亮/暗 CSS，用于 Branding 草稿预览且不改变应用级主题状态。设置入口、非模态容器和工作区文案由 Web
壳拥有。新增公开组件时同步更新显式 export、README 和相应契约测试。
`ManagementWorkspace` 将列表与详情放在无外框的同一工作区，组合本包从 vean 导入的 Splitter 源码组件，提供可拖拽、可键盘调整的竖向分割线；页面名称仅保留给无障碍语义，并处理窄屏列表/详情切换；
`ManagementListToolbar` 统一列表头部高度、展开搜索与新增图标入口。搜索框只保留一个尾部 ×：有关键词时清空并保持输入焦点，空白时收起搜索；Escape 可随时收起并保留关键词。清空、关闭、返回与分割线的文案/无障碍名称可通过 prop 覆盖。
这些组合不包含模块数据或业务操作；普通筛选框直接使用 `Input`。
Branding 的 V2 配置由模块自有的纯适配器转换为 Vean 的原生 token overrides；自定义主色色阶通过
受控 `primaryRamp` 供 `bg-primary-50` 等 recipe 消费。预览和全局 Provider 使用同一 CSS 生成路径，
不再注册全局主题色板，也不再创建临时 registry key。旧的 `registerThemePalette`、`themePaletteKey`、
`createThemePaletteSlot` 与 `registerBrandThemePalettes` API 已移除，现有调用点均完成迁移。
Vean 的颜色通道不保存表面透明度，本地主题适配器为其余语义色补充 `--<token>-alpha`，
通过 `@jingwei/ui/theme-unocss` 的 UnoCSS postprocess 与工具类透明度相乘；边框、输入框和蒙层
继续使用引擎原有透明度规则。Provider 与 ThemeScope 生成同样的明暗透明度变量，并显式恢复
未覆盖角色的透明度，保证局部预览不继承外部主题的透明状态。已保存的 `transparent` 无需迁移。

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

配置位于本包的 `vean.json`，CLI 的 cwd 也固定到本包，因此不需要再移动文件、改 alias
或手工拼接依赖。生成结果属于本仓库源码：提交前要 review diff，保留有意的本地修改，
并为可回归的交互补测试。当前 vean 0.50.0 可能输出 `ui/theme` registry warning；只要
预览/生成的目标均位于本包且质量门禁通过，该警告不要求人工重排目录。

生成代码使用 `#ui/*` 私有 alias。它只在本包 `package.json#imports` 和 tsconfig 中解析，
不会成为对外 export。为兼容上游 Vue prop spread 的可选属性表达，本包局部关闭
`exactOptionalPropertyTypes`；`strict` 与仓库其他严格检查仍保持开启。不要在生成文件中
通过 `any`、`@ts-ignore`、`eslint-disable` 或 `as unknown as` 规避类型问题。
包的 `types` export 指向稳定的 `public.d.ts` 门面，避免业务包用自己的编译选项重复检查
UI 实现；每个新增公共组件都必须同步补齐该门面，防止运行时 export 与消费者类型漂移。

## Headless 与主题边界

- `@vean/aria` 负责 ARIA、键盘、焦点和受控状态；
- 本地 styled 源码负责 DOM 组合、API、UnoCSS recipe 和视觉表现；
- `@vean/theme` 提供语义 token、主题生成、持久化与首屏脚本；
- `@vean/unocss` 在 Web 构建时生成默认 token 和 reset；
- `@vean/ui` 是禁止依赖，`pnpm architecture:check` 会拦截 package dependency 和源码 import。

`Layout` 基于 headless LayoutCompact，公开受控 Sider、区域尺寸、独立 Content 滚动、移动端和
Header/Tab/Content slots；`LayoutTrigger` 复用同一个上下文。`Tabs`、`TreeMenu`、`TreeNav`、`Menubar`、
`Breadcrumb`、`Popover` 与 `PageTabs` 分别包装对应的 Vean Headless Compact/primitive，保留
其 WAI-ARIA、键盘、焦点、受控状态和浮层定位语义，本包只负责公共 API 与 UnoCSS recipe。
应用只从本包公共入口使用它们。
`Tree` 完整组件族来自 vean 0.50.0 模板，包含状态驱动的展开/折叠动画、普通与动画虚拟列表。
`item` slot 由消费者组合 `TreeItem`，传入 `value`、`level`；管理树显式启用 `allowParentSelect`，
并通过 `modelValue` / `expanded` 受控状态将选择和展开交给 Vean。节点保留
`data-vean-tree-value`（值为 item.value），以便 styled 层在动画重建节点后按稳定身份恢复键盘焦点；
用户主动移到其他控件时不会抢回焦点。导航、组织、字典的业务筛选与节点操作仍由各模块拥有。
`TreeVirtualizer` 必须指定 `height`，item slot 还需将 `virtualItem` 传给 `TreeVirtualizerItem.data`；
`animated` 默认关闭，可按数据量启用。公开类型包含节点事件、slot 和虚拟列表 props/emits。
`TreeNav` 是与 TreeMenu 对应的横向多级导航，通过 `modelValue` 保持叶节点与祖先高亮；支持
悬停/键盘打开、分组、外链和溢出“更多”。Header 的无外框呈现由应用壳通过 `ui` 调整，
共享组件不读取 Router 或 Navigation store。

Web 根节点挂载本地 `ConfigProvider`。Provider 使用单一 `#vean-theme` head style，并同时装配本地 Toast、Dialog 和 Progress provider；
`useTheme()` 复用同一个上下文。租户壳把 Branding 的完整色阶、语义覆盖、圆角和命名方案转换为受控主题，
只将明暗模式与尺寸作为 tenant+user 范围的个人偏好；平台壳使用固定主题。Web 自有的首屏脚本只恢复
明暗模式提示以避免闪烁，不恢复旧版用户颜色。`ThemeScope` 仅提供局部预览，不能作为绕过租户品牌
策略的第二套全局 Provider。

## 组件完成要求

- 使用语义化 HTML，并验证标签、键盘、焦点、disabled/loading/error 等相关状态；
- props、events、slots 与受控/非受控状态清晰，基础组件不读取业务 store 或调用 API；
- 样式使用语义 token 和可静态扫描的完整 UnoCSS class；
- 不为单一页面样式过早加入平台层，不建立 `common`/`misc` 垃圾桶；
- 运行仓库 `AGENTS.md` 要求的完整质量门禁。
