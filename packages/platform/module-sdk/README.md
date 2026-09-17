# `@jingwei/module-sdk`

Jingwei 模块化和 Edition 机制的核心 SDK。它定义 manifest、Edition 解析、运行时注册表，以及 Server/Web 模块接入契约。

完整概念和算法见 [Edition 与 Module 手册](../../../docs/edition-module-handbook.md)。

## 导出入口

| 入口                         | 内容                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `@jingwei/module-sdk`        | manifest、Edition、`ModuleRegistry`                            |
| `@jingwei/module-sdk/server` | Hono 变量、OpenAPI Router、模块上下文与 Server Module 安装契约 |
| `@jingwei/module-sdk/web`    | `WebModule` 与页面绑定                                         |

Server/Web 契约拆成子路径，避免纯 manifest/构建工具无意引入 Hono 或浏览器相关类型。

## Manifest

`defineModule` 校验并冻结模块静态定义：

- module id 必须是稳定的小写连字符标识；
- capability、permission、route 和依赖不能重复；
- permission 与 route key 必须由本模块命名空间拥有；
- route 引用的 capability/permission 必须存在；
- 公开路由不能同时要求 permission。
- route.layout 是默认布局；可选 allowedLayouts 必须包含该默认值。Navigation 只能在此列表内选择，省略列表时仅允许默认布局。

`optionalDependencies` 只表达可选增强，Edition 解析不会自动把它们加入依赖闭包。

## Edition 解析

`resolveEdition`：

1. 验证模块目录没有重复 ID；
2. 从 Edition 根模块递归加入必需依赖；
3. 检测未知模块和循环依赖；
4. 生成依赖优先、稳定排序的模块列表；
5. 校验选择的 capability 属于模块；
6. 校验 capability 的额外模块要求；
7. 返回每个模块实际启用的 capability 集合。

解析结果应在构建期生成，Server、Web、迁移共用，不能分别实现三套筛选算法。

## `ModuleRegistry`

运行时只读目录，可查询 Edition ID、模块、已启用能力、路由、权限定义和已解析的 Edition 默认导航。构造时再次阻止跨模块重复 route key 和 permission code。

注册表不是权限引擎：`hasCapability` 说明产品能力存在，不说明当前用户已获授权。

RouteDefinition.requiredPermission 保留功能权限的静态关联和注册校验，不作为导航 code grant 的替代品。Navigation 的 PERMISSION 节点按自身 code 授予角色；功能 API 仍校验 manifest permission。

## Server Module

`ServerModule.install(context)` 返回：

- `id`：与 manifest 一致的模块标识；
- `basePath`：挂在 `/api/v1` 下的模块路径；
- `routes`：模块自己的 Hono 路由；
- 可选 `dispose`：模块级后台资源的释放函数。

有 HTTP endpoint 的模块使用 `createApiRouter()` 建立带统一 Zod validation error 语义的 `OpenAPIHono`，route contract 位于模块 `server/api/openapi.ts`。空模块也不得在 `server/module.ts` 内联 handler。

每个 Module route 必须使用 `createApiRoute()`，并声明 `PUBLIC`、`AUTHENTICATED`、
`REFRESH_TOKEN` 或 `PERMISSION`。PERMISSION 同时列出 capability、permission 与
scoped/unscoped 模式；工厂把它写入 OpenAPI `x-jingwei-authorization`。Server 启动会用
当前 `ModuleRegistry` 校验所有已启用 `/api/v1` operation。该 metadata 不执行授权，最终
安全边界仍是 Application Use Case。

功能权限使用 `definePermissionRequirement()` 在 Owner Module 定义一次不可变 requirement；
Application 的 IAM 授权端口和 `permissionApiAccess()` 接收同一个对象。不要在 OpenAPI 和
Use Case 中分别书写 permission/capability 字符串。跨模块 requirement 必须从 Owner Module
的公开 package export 导入。

安装函数可以创建仓储和用例，但导入 manifest 本身必须无副作用。模块不能监听端口或关闭共享数据库池。

## Web Module

`WebModule.pages` 把 manifest 的 `routeKey` 绑定到构建注册表中的 `pageKey`。服务端 Navigation 返回 route key 后，Web 壳同时解析 route definition 和页面绑定；任何缺失都应快速失败。

WebModule 不提供 configure/startup hook。跨模块 UI adapter 由 Edition Builder 生成显式 `app.provide` 装配，禁止模块 import 时修改全局变量。

## 修改 SDK

这是高影响包。变更时必须：

- 为所有新校验和失败分支补单元测试；
- 用 development/full Edition 做解析回归；
- 运行 Edition Builder、Server build 和 Web build；
- 检查生成产物和物理裁剪；
- 更新专题文档和 ADR；
- 避免把某个业务模块的专属字段塞进通用 manifest。
