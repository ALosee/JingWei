# ADR 0010: Source-controlled UI Foundation

- Status: Accepted
- Date: 2026-09-09

## Context

Jingwei 需要无业务 UI 原语、跨模块组合组件和模块业务组件三种不同所有权。早期 Button 被
手工压缩为本地单文件结构，而 sbean 按 SoybeanUI 的完整组件族生成 `components`、`styles`、
`theme` 和 Provider 依赖。两套结构不一致，导致每次增加组件都要移动文件、改 import、补依赖
和重新解释哪些生成文件可以保留。

项目要求完全掌控 styled 组件源码。继续依赖 `@soybeanjs/ui` 提供 ConfigProvider、Dialog
或 ThemeCustomizer 会形成例外：业务原语受源码控制，但全局主题与 overlay 基础设施仍由已
编译包决定，升级和定制边界不一致。

## Decision

`@jingwei/ui` 拥有完整 styled layer，不依赖 `@soybeanjs/ui`。继续固定使用 Soybean 生态的
`@soybeanjs/headless`、`@soybeanjs/theme`、`@soybeanjs/ui-uno`、`@soybeanjs/cva`、相关工具包
和 sbean；headless 负责可访问性交互，本地源码负责 DOM 组合、视觉 recipe、主题 Provider
和公共 API。

sbean 配置放在 `packages/platform/ui/sbean.json`，根脚本始终以该包为 cwd：

```text
pnpm ui:inspect <component>  # dry-run
pnpm ui:add <component>      # 写入完整组件族及依赖
pnpm ui:diff <component>     # 比较已存在源码
```

生成源码保持上游原生的小写路径、文件拆分和内部 `S*` 命名，使用包私有 `#ui/*` alias。
`@jingwei/ui/src/index.ts` 是公共适配边界，只在这里导出 `Button`、`Input`、`Dialog`、
`ConfigProvider` 等无前缀名称。这样上游升级 diff 不会被机械重命名污染，业务调用方也不暴露
来源实现细节。

目录所有权固定为：

| 位置                                        | 所有内容                                   |
| ------------------------------------------- | ------------------------------------------ |
| `packages/platform/ui/src/components`       | sbean 管理的无业务基础组件及组件族依赖     |
| `packages/platform/ui/src/styles` / `theme` | 本地 styled recipe、主题状态和 Provider    |
| `packages/platform/ui/src/patterns`         | Jingwei 编写的跨模块通用组合模式           |
| `packages/modules/<id>/src/web/components`  | 具有明确领域词汇和变化所有者的模块业务组件 |
| `apps/web/src/components`                   | 只属于应用壳的组件                         |

Web 根节点挂载本地 `ConfigProvider`。它拥有主题持久化以及 Toast、Dialog、Progress provider；
`@jingwei/ui` 的 `ThemeSettingsPanel` 使用同一 `useTheme()` 上下文，不建立第二个 store。
设置入口、非模态 Popover、挂载位置和工作区文案由 Web 壳的 `global-settings` 布局模块拥有。
架构检查禁止
任何 workspace package 声明 `@soybeanjs/ui` dependency，也禁止 authored source 导入它。

sbean 0.30.0 生成的 Vue prop forwarding 与仓库开启的 `exactOptionalPropertyTypes` 表达不兼容。
为了保持生成源码可直接落地，本包局部关闭这一项；`strict`、`noUncheckedIndexedAccess`、Vue
类型检查、lint 和组件测试仍启用。相比为每个生成文件重复加入非空断言或强制转换，这个例外
集中、可审计，升级模板后应重新评估。

由于 monorepo 在消费源码 package 时会用调用方 tsconfig 再检查实现，`@jingwei/ui` 的 `types`
condition 指向显式 `public.d.ts` 门面，运行时 `default` condition 仍指向源码入口。公共组件新增
时必须同时更新运行时 export 与类型门面；UI 自身继续由 `vue-tsc` 直接检查全部实现。

## Alternatives

- 继续依赖 `@soybeanjs/ui`：接入快，但 styled 源码、Provider 和主题设置无法完全受控，违背
  项目选择的所有权边界。
- 每次只摘取并重组生成文件：短期目录更小，但持续产生人工迁移成本，且容易漏掉组件族依赖、
  context、overlay provider 和新样式 token。
- 完全脱离 Soybean 生态自行实现：控制力最大，但重复承担 ARIA、键盘、焦点、主题生成和大量
  交互测试成本，没有当前需求支撑。

## Consequences

新增 Input、Select 等基础组件不再需要重排目录；正常流程是 inspect、add、review、公开 export
和测试。生成器可能增加尚未直接使用但属于完整组件基础的 Icon、Link、Dialog、Toast、Progress
等源码，这些文件随仓库版本化并接受统一质量检查。

仓库承担本地 styled 源码的维护和升级合并成本，但获得完整定制能力、可追踪 diff 和稳定公共
API。模块业务组件拥有明确位置，不会为了“复用”被错误塞进平台 UI。`@soybeanjs/ui` 未来若要
重新引入，必须用新 ADR 说明为什么源码所有权策略不再成立，并同时调整架构守卫。
