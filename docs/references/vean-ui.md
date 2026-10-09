# VeanUI 上游参考与迁移记录

Jingwei 使用 VeanUI 的 aria 行为、主题引擎、UnoCSS preset 与 CLI 源码模板，`@jingwei/ui` 拥有
styled 组件及公开 API。禁止依赖 `@vean/ui` 或旧名 `@soybeanjs/ui`。

## 固定版本与来源

| 项目              | 值                                                                                |
| ----------------- | --------------------------------------------------------------------------------- |
| 官方仓库          | `soybeanjs/vean-ui`                                                               |
| 稳定版本          | `0.50.0`，不是 `0.5.0`                                                            |
| 发布 tag          | `v0.50.0`，commit `937ee621b2b8e79dd9576791997eccd92b6aae6c`                      |
| 品牌更名 commit   | `f77bb70`（tag 之后发布同版本的 `@vean/*`）                                       |
| 消费者 Skill 快照 | 更名后 commit `7ed24b523521525e097b4baf2b962e5933e871c5`；之后的更改仅涉及文档/CI |
| 引入日期          | 2026-10-08                                                                        |
| License           | MIT；本地 Skill 保留上游许可证                                                    |
| 本地知识          | `.agents/skills/vean-aria/`、`.agents/skills/vean-ui/`                            |

依赖通过根 catalog 固定：`@vean/aria`、`@vean/theme`、`@vean/unocss`、`@vean/cli` 为 `0.50.0`，
配套 `@soybeanjs/colord` 为 `0.8.1`。`@soybeanjs/cva`、`@soybeanjs/utils`、
`@soybeanjs/unocss-preset` 与独立的 `@soybeanjs/fetch` 没有随 UI 更名，保留其已发布的最新稳定版本。
Tree 完整组件族直接使用已存在的传递依赖 `@tanstack/vue-virtual`，因此 UI package 显式声明其固定版本。

CLI 配置为 `packages/platform/ui/vean.json`，入口为 `vean`，UnoCSS 使用 `presetVean()`。
本次先通过 `ui:inspect` 核对，再在独立目录生成所有已安装组件族与 ThemeCustomizer，合并回源码。
CLI 仍可能提示 `ui/theme` registry 项不存在；已生成的 theme 目录及其新 adapter 经类型、构建和交互验证。
模板 registry 是在线来源，后续升级仍须 review，不能假定只更新 CLI 就会自动更新本地组件。

## 组件迁移清单

原有组件均保留 `@jingwei/ui` 的无前缀公共名称；没有因上游移除而无法迁移的现有组件。

| 范围       | 原有组件族                                                                                                                                    | 迁移及验证重点                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 操作与展示 | Button、Icon、Link、Breadcrumb、Separator、Collapsible                                                                                        | 安全 button type、disabled、异步等待、链接目标、语义 DOM               |
| 表单控件   | Input、InputNumber、Textarea、Switch、Select、Segment、Slider、ColorPicker                                                                    | 模型更新、键盘、禁用状态、控制元素标签、完整色阶编辑                   |
| 浮层与反馈 | Dialog、DropdownMenu、Popover、Tooltip、Toast、Progress                                                                                       | Provider 装配、打开/关闭、非模态设置、嵌套色阶编辑器、ARIA progress    |
| 导航与布局 | Layout、Tabs、Tree、TreeMenu、TreeNav、Menubar、PageTabs、Splitter                                                                            | 桌面/移动端、侧栏收缩、菜单目标、页签选中/关闭、树交互、分栏键盘/拖动  |
| 主题与组合 | ConfigProvider、ThemeSettingsPanel/ThemeCustomizer、PalettePicker、ThemePaletteSelect、ThemeScope、ManagementWorkspace、ManagementListToolbar | scoped 偏好、系统明暗变化、草稿隔离、品牌发布、受控色阶、列表/详情切换 |

生成组件族保持原生目录与 `S*` 内部名称；Menu、PalettePicker、ThemeModeSegment 和 Tree motion/
virtualizer 部件随新版依赖补齐。`public.d.ts` 仍是类型门面，公共组件没有暴露上游 `S*` 名。

## 主题兼容与 API 调整

0.50.0 的主题引擎已经更换，旧的 registry、sidebar/chart scheme 与 lightLevel/darkLevel API 均被移除。
Branding 的 `shared/brand-theme-options.ts` 负责把已发布 V2 合同转换成新版的 kebab-case token
`overrides`，保留侧栏、图表方案、深浅层级、原有圆角尺寸，以及仅浅色覆盖时的深色推导。
服务器发布校验、编辑器对比度提示、局部预览与全局 Provider 共用此纯适配器。

自定义中性/主色色阶转换成显式颜色，不再修改主题引擎注册表；受控 `primaryRamp` 输出全套
`--primary-50` 至 `--primary-950`，供新版组件 recipe 使用。原有色阶编辑和存储合同不变，不需要数据库 Migration。
旧的 `registerThemePalette`、`themePaletteKey`、`createThemePaletteSlot`、`registerBrandThemePalettes`
内部集成 API 已移除，所有仓库调用点都改为受控主题。详见 [ADR 0022](../adr/0022-migrate-source-owned-ui-to-vean.md)。

运行时 DOM/CSS 契约改用 `data-vean-*` 与 `--vean-*`，页签状态改为 `data-selected`。
Provider 维护 head 内的唯一 `#vean-theme`；Web 的 tenant+user 偏好与首屏模式提示继续由 Web 所有。
Vean 引擎自身采用 `__VEAN_THEME` envelope；租户 Provider 不读取未归属账号的旧引擎颜色配置。

没有安装日期、Table、Form、NavigationMenu、Sheet/Drawer 或已经下线的 UI-X/Admin/Chart 包；这些
上游 breaking changes 不需要迁移仓库中的组件。这里不新增其产品功能。

## 本地差异与后续升级

- ButtonLoading 保留等待异步 handler、阻止重复点击与 `aria-busy` 的 Jingwei 修复。
- Select 将根属性透传给 trigger；Textarea 将无障碍属性透传给实际 control。
- 顶部导航接入完整 TreeNav 源码族，通过 `modelValue` 传递当前路由对应的 navigation code；覆盖父级高亮、悬停、键盘、溢出“更多”、移动端与刷新。Menubar 继续作为命令菜单组件提供。
- TreeNav 及其弹出菜单的图标同时响应自身 `data-selected="true"` 与祖先 `data-child-selected` 高亮，取消选中后恢复弱化颜色。
- 模板中未校验的索引使用明确 fallback；slot 返回值使用 `unknown`，不引入 `any` 或 lint suppression。
- 本地 ConfigProvider 的纯 `theme-context.ts` 保留消费者类型边界；公共类型回归测试检查 declaration facade 不会静默丢失类型。
- 收缩 TreeMenu 保留图标行居中和相同的选中/hover 表面宽度。
- TreeNav 通过公开 popup props 补齐非模态 hover 深层菜单 Escape 关闭后的焦点恢复；依据弹层 ARIA 所属关系定位入口，并保留用户主动移往其他控件的焦点。
- TreeNav styled 包装层将弹层中的 `isGroup` 适配为其下拉菜单公开协议的 `isGroupLabel` 与同级子项，确保纯分组标题不变成额外子菜单。
- 本地 `primaryRamp` 是 styled layer 对完整自定义主色色阶的显式接入；不复制 aria 内部实现。
- Tree 已重新通过 `ui:inspect`、`ui:add tree --overwrite` 和 `ui:diff` 对照完整 0.50.0 模板；公共入口补齐 TreeVirtualizer/TreeVirtualizerItem 和节点事件类型。保留 slot 返回 `unknown`、安全索引和 slot 局部变量命名的类型适配。
- Tree styled 层通过节点的 `data-vean-tree-value` 和 Vue 更新钩子恢复动画重新挂载后的键盘焦点，修复连续展开多层时焦点落到 body 的回归；原生 aria 的选择、展开和动画状态机保持上游实现。导航、组织与字典三页均使用 Tree/TreeItem，行选择与箭头展开分离。

升级时同时更新包、生成组件、消费者 Skill 快照与本页来源；先看版本跨度内的 release/migration guide，
保留上述差异，并运行根 `pnpm check` 与 `pnpm test:e2e`。Skill 的组件指南推荐直接引入 `@vean/ui`；
在 Jingwei 始终以 AGENTS.md、已接受 ADR 和本地 `jingwei-ui-development` Skill 的所有权约束为准。

官方入口：[发布说明](https://veanui.com/releases/)、[0.50.0 升级指南](https://veanui.com/overview/migration/v0.50.0/)、
[品牌迁移](https://veanui.com/overview/migration/rebrand/)、[固定版本源码](https://github.com/soybeanjs/vean-ui/tree/v0.50.0)。
