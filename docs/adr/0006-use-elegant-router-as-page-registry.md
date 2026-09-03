# ADR 0006: Use Elegant Router as Page Registry

> 更新：layout 的来源与导航节点模型已由 [ADR 0007](./0007-unified-navigation-and-role-grants.md) 部分取代；数据库选择布局，Manifest 限制 allowedLayouts。以下保留原决策背景。

- Status: Accepted
- Date: 2026-09-01

## Context

平台最终可能有数百页面，需要自动发现、lazy import 和类型生成；同时 Tenant 必须能够动态编排 path/menu，Edition 必须物理裁剪页面。

## Decision

使用 Elegant Router，但仅作为 Build-time Page Discovery / Component Registry Generator。Edition Builder 生成启用模块的 `pageDir`。稳定 routeKey、安全声明与 layout 来自 Module Route Definition；运行时 Navigation 决定合法 path/menu。

## Alternatives

手写全部 component imports 机械且易错；让文件路径直接成为最终 URL/业务 route identity 会使数据库配置被源码重构破坏，也无法安全支持 Tenant 动态编排。

## Consequences

Elegant Router 不拥有 Permission、Runtime Navigation、Tenant Menu、Edition、最终 URL 或 routeKey。数据库不得保存 Vue 文件路径，未启用模块页面不得进入 Vite bundle。
