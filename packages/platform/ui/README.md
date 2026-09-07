# `@jingwei/ui`

Jingwei Web 的基础 UI 组件与全局设计样式入口。它提供无业务归属的视觉原语，业务页面仍由各模块拥有。

## 导出

| 入口                     | 内容                           |
| ------------------------ | ------------------------------ |
| `@jingwei/ui`            | `Button`、`PageContainer`      |
| `@jingwei/ui/styles.css` | 全局 token、基础元素和通用样式 |

Web 壳在应用入口导入一次 `styles.css`。模块不重复加载全局样式，避免顺序依赖。

## 组件

### `Button`

以 `@soybeanjs/headless/button` 为无障碍交互基底，在本仓库中拥有视觉 API。当前提供
`primary`、`secondary`、`outline`、`ghost`、`danger` 五种 variant，`sm`、`md`、`lg`
三种尺寸以及 `loading` 状态。业务模块只从 `@jingwei/ui` 导入，不直接依赖 SoybeanUI。

组件源码基于 SoybeanUI `0.30.0` 的 Button 做最小适配：保留 headless 的默认
`type="button"`、禁用语义和事件保护，样式收敛为 Jingwei 的 token 与 UnoCSS recipe。未复制
ButtonGroup、ButtonLink、图标等尚未使用的实现。

### `PageContainer`

工作区页面的统一内容边界，用于标题、间距和内容布局。页面组件把业务区块放入容器，不直接修改应用壳布局。

## 设计边界

适合加入本包：

- 多个模块重复使用的无业务组件；
- 颜色、间距、字体、圆角等设计 token；
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
命名、语义 token、显式 exports 和现有测试。
