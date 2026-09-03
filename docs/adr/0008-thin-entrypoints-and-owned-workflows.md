# ADR 0008: Thin Entrypoints and Owned Workflows

- Status: Accepted
- Date: 2026-09-03

## Context

Web main.ts 同时承担 Vue 启动、匿名/会话导航加载、默认首页选择和失败恢复；Server 入口混合监听与关闭实现，app.ts 混合装配与错误协议。导航管理页面同时管理节点编辑、版本发布与角色授权，CLI 中也存在入口与实现混合的问题。只移动 main.ts 的代码无法阻止同类问题复发。

## Decision

区分可执行入口、Composition Root、功能流程、规则/策略、技术适配器和展示层。入口只调用具名启动函数；装配选择实现并注入，不实现功能策略；业务规则仍留在所有者 Module 的 Application/Domain。跨 IAM/Navigation 的 Web 启动流程由 Web 壳拥有，不下沉为无归属 platform helper。

导航加载顺序与纯首屏目标选择分离；Server 的 HTTP 错误映射、请求安全、日志和进程生命周期按职责分离；页面按功能状态所有权拆成模块自有 composable，保留 Vue 模板和简单交互绑定。CLI 保持原命令路径，具名 commands 函数承接运行环境与生命周期；模块生成器分离模板、文件写入与命令边界。

保留显式 Factory/Constructor Injection，不引入 DI Container、Service Locator、通用启动插件系统或新的依赖。被导入的实现无启动副作用；Router 和进程资源由启动工厂显式创建。

架构检查新增 TypeScript AST 规则，覆盖应用/工具入口、装配、分层和页面。已有跨模块规则继续保留。以最小正反例测试规则，不采用全仓统一行数限制。

## Alternatives

- 只提取一个 bootstrap 函数：入口虽短，职责混合仍存在，难以独立验证策略。
- 为每个步骤增加抽象接口/文件：造成无价值间接调用，不采用。
- 仅靠 AGENTS.md 或 lint 行数上限：不能约束真实依赖方向，因此同时增加架构检查和行为测试。

## Consequences

入口能直接读出启动意图，功能流程可不启动浏览器/数据库而独立测试。文件数增加，但每个文件有明确所有者与变化原因。Server 关闭会先等待 HTTP 停止，再释放数据库，重复信号共享同一次关闭；启动失败也释放已创建资源。

HTTP 协议、权限模型、导航配置、数据表与迁移不变。已有开发种子的受控数据库写入仍属于工具运维用例，本 ADR 不扩展生产管理能力。检查器是语法护栏，不是完整静态证明；别名包装、任意动态调用等仍需代码 review。
