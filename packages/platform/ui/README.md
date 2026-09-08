# `@jingwei/ui`

Jingwei Web 的基础 UI 组件包。它提供无业务归属的视觉原语，业务页面仍由各模块拥有。

## 导出

| 入口          | 内容                      |
| ------------- | ------------------------- |
| `@jingwei/ui` | `Button`、`PageContainer` |

全局默认主题由 Web 壳的 UnoCSS 配置生成，运行时主题由根 SConfigProvider 更新。
本包的 theme.css 加载上游组件样式，不维护另一份 CSS 变量。

## 组件

### `Button`

以 `@soybeanjs/headless/button` 为无障碍交互基底，在本仓库中拥有视觉 API。`color`
采用 Soybean 的 `primary`、`secondary`、`accent`、`destructive`、`success`、`warning`、
`info`、`carbon` 语义，`variant` 提供 `solid`、`outline`、`soft`、`ghost`，`size` 与
Soybean 主题的 `xs` 到 `2xl` 对齐，并支持 `loading` 状态。业务模块只从 `@jingwei/ui`
导入，不直接依赖 SoybeanUI。

组件源码基于 SoybeanUI `0.30.0` 的 Button 做最小适配：保留 headless 的默认
`type="button"`、禁用语义和事件保护，样式 recipe 直接消费 Soybean theme token。未复制
ButtonGroup、ButtonLink、图标等尚未使用的实现。

### `PageContainer`

工作区页面的统一内容边界，用于标题、间距和内容布局。页面组件把业务区块放入容器，不直接修改应用壳布局。

## 设计边界

适合加入本包：

- 多个模块重复使用的无业务组件；
- 基于 Soybean theme token 的共享视觉约定；
- 可访问性和交互一致性的基础行为；
- 通用布局原语。

不适合加入：

- “组织选择器”“角色授权面板”等有明确模块所有权的组件；
- 直接请求 API 的组件；
- 依赖某个 Edition 或权限 code 的组件；
- 为单个页面定制的样式。

## 新增组件要求

- 使用语义化 HTML 和键盘可操作交互；
- 明确 props、events、slots 和受控/非受控状态；
- 支持 loading、disabled、focus 和错误状态；
- 不在组件内部读取全局业务 store；
- 样式通过 token 表达，不散落重复常量；
- 至少在真实页面或组件测试中验证；
- 破坏外观或 API 的改动要检查所有模块调用方。

## 源码同步流程

根 `sbean.json` 把 `ui` 输出目录指向本包，`sbean` 与 Soybean Headless 版本固定为 `0.30.0`。
新增组件前先运行 `pnpm ui:inspect <component>` 检查依赖和文件，再只复制当前需要的
primitive、类型和样式 recipe。生成结果是上游参考，不直接覆盖本地组件；合并时保留无前缀公共
命名、Soybean 主题语义、显式 exports 和现有测试。

## 运行时主题

根 `App.vue` 使用从本包导出的上游 `SConfigProvider`，开启 `persist-theme` 并设置
`locale="zh-CN"`。Provider 是运行时主题状态的唯一所有者，`useTheme()` 和
`SThemeCustomizer` 共享同一个上游上下文，不另建 Pinia 主题 store。

`ThemeSettings` 是本地拥有的设置入口和弹窗容器，内部按需加载上游 `SThemeCustomizer`。
支持浅色/深色/跟随系统、基础色、主色、圆角、全局尺寸、配色方案、token 覆盖与重置。
设置保存在当前浏览器，由 Provider 负责恢复和跨标签页同步；它不是租户级服务端配置。
登录、工作区及恢复页都处于同一个 Provider 下。

`@jingwei/ui/theme.css` 加载上游组件 CSS 和浏览器 color-scheme。
`@jingwei/ui/theme-init` 提供上游首屏初始化脚本，在 HTML head 提前恢复明暗模式；完整
配色由 Provider 挂载时恢复。构建默认主题来自 `sbean.json`，当前与上游 zinc/indigo/md
默认值一致。不要把可编辑默认值固定传入 Provider 的 `theme` prop，否则会覆盖用户设置。

Provider 和主题设置器作为上游基础设施依赖 `@soybeanjs/ui@0.30.0`；Button 等业务使用的
基础组件仍保留本地源码。此基础设施例外保留 `SConfigProvider` 原名以明确实现来源。
