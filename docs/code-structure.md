# 代码职责与入口约束

这里回答“代码应该放在哪里”，不是“一个文件最多能有多少行”。设计依据是 [ADR 0008](./adr/0008-thin-entrypoints-and-owned-workflows.md)，强制规则见 AGENTS.md 第 3.1 节。

## 1. 六种职责

| 层次                                | 负责                                        | 不负责                                |
| ----------------------------------- | ------------------------------------------- | ------------------------------------- |
| 可执行入口                          | 导入并调用启动函数                          | 功能分支、HTTP、SQL、编辑状态         |
| Composition Root                    | 创建资源、选择实现、连接依赖、注册模块      | 页面筛选、权限决策、内联 HTTP handler |
| 功能流程 / Application / controller | 协调一次明确任务及状态、处理成功/失败       | 拼装全局 Runtime、创建隐式单例        |
| 规则 / 策略 / Domain                | 给定输入得出判断或目标                      | 浏览器、环境变量、数据库连接          |
| Adapter                             | HTTP、Router、PostgreSQL、Cookie 等技术实现 | 决定模块业务授权或事务边界            |
| 页面 / View                         | 模板、展示、声明式绑定、组合 controller     | 多步骤网络提交、角色/版本状态混管     |

这不是要求每个功能机械建立六个文件。一个简单、职责清晰的函数可以保留；只有出现独立规则、资源或状态所有权时才拆。库的 index.ts 可能是导出入口，也可能直接实现一个小型公共能力，不适用可执行入口的限制。

## 2. Web 启动

```text
main.ts
  -> bootstrap/start-web.ts           创建 Vue、Pinia、Router，注入实际客户端与适配函数
     -> navigation/initialize-navigation.ts  编排 bootstrap → session → 可选 me
        -> navigation/initial-location.ts   纯首屏目标选择
     -> router/dynamic-routes.ts      Edition 页面映射与动态安装
     -> mount
```

main.ts 只保留 startWebApplication 调用。bootstrap 可以知道“使用哪个实现”，但不负责判断“匿名或已登录应该去哪里”。这条规则没有下沉到 Navigation 服务端，因为它依赖 Web 启动场景；也没有放进 platform/utils，因为它不是通用工具。

initializeNavigation 接收最小端口：加载公开导航、恢复会话、加载用户导航、安装/识别/跳转路由，以及壳状态。不需要真正的 Vue App、Pinia 或 window，就能测试调用顺序和失败恢复。initial-location 只根据导航与初始 URL 决策，可用表格测试深链接、未知路径和默认首页。

Router 改为 createApplicationRouter 工厂；import 路由文件本身不会创建浏览器 history。行为保持：匿名不请求 me，已登录替换完整投影，刷新保留 URL 参数/query/hash，失败进入静态恢复页。

## 3. Server

```text
index.ts -> bootstrap/start-server.ts
              |- runtime.ts          创建共享资源
              |- app.ts              注册中间件、系统路由和 Edition 模块
              `- shutdown.ts         幂等关闭流程

app.ts -> middleware/request-context.ts（显式顺序）
             request-id -> session-security -> request-logging
       -> http/system-routes.ts
       -> http/errors.ts
       -> Module.serverModule.install()
```

app.ts 是 HTTP 装配函数，保留注册顺序，不内联错误转换或业务 handler。request-context 是请求管线装配：关联 ID、安全、日志各有自己的最小依赖。模块的 server/module.ts 同样只装配自身用例与适配器。

start-server 负责进程边界，建立监听并注册信号；shutdown 负责一次关闭的状态。HTTP 关闭完成后才释放 Pool，重复信号复用同一 Promise。安装/监听失败时释放 Runtime。应用层不能通过 Runtime 随意寻找服务。

## 4. 模块页面

导航管理页仍保留完整模板，其脚本只组合：

| Composable              | 状态与职责                                      |
| ----------------------- | ----------------------------------------------- |
| useNavigationManagement | 实际客户端/确认框的装配与首次加载               |
| useNavigationEditor     | 本地节点、选中项、脏状态、JSON 字段，不请求接口 |
| useNavigationVersions   | 版本列表、发布指针、保存/校验/发布/回滚         |
| useRoleNavigationGrants | 所选角色、已加载角色、原始/编辑 code 集合       |
| useNavigationFeedback   | 该管理页的 busy、安全错误、操作反馈             |

这些不是任意共享状态：角色授权不会因版本回滚而恢复，所以不能与版本编辑共用一套“保存状态”。版本保存返回新节点 ID，编辑器必须采用返回快照；角色保存则使用原始 code 集合做并发比较。

IAM 登录页使用 useSignIn 管理提交状态和成功后的跳转。页面仍可以拥有纯展示 computed、DOM 交互和简单绑定，不要求把每个变量拆到新文件。

### 4.1 Web 组件归属

```text
packages/platform/ui/src/components/          # sbean 管理的无业务基础组件
packages/platform/ui/src/patterns/            # 跨模块通用组合模式
packages/modules/<id>/src/web/components/     # 模块业务组件
apps/web/src/components/                      # 仅属于应用壳的组件
```

`@jingwei/ui` 源码拥有 styled layer，只以 `@soybeanjs/headless` 和 theme/recipe 包为底层；
业务与应用代码禁止导入 `@soybeanjs/ui`。模块组件的判断标准是业务语义和变化所有权，不是
文件大小：OrganizationPicker 属于 Organization，即使多个模块使用也应通过该模块公开的
Web 契约演进；Button、Input、Dialog 等无业务词汇的原语才属于平台 UI。页面专用的小组件
可以紧邻页面，形成稳定复用后再移入模块 `web/components`，不预设万能 common 目录。

## 5. 工具入口

现有命令路径不变，例如 seed-dev.ts 仍是脚本入口，但只调用 commands/seed-dev.ts 的具名函数。argv/env、日志、退出状态和资源生命周期属于该命令边界，导入实现文件不会立即连库或执行种子。

模块生成器额外区分：commands/create.ts 解析输入，generate.ts 验证目标并写文件，templates.ts 纯粹返回文件内容。模板测试无需操作仓库；文件测试只操作自身创建的临时目录，并验证不覆盖已有模块。

commands 是有明确目的的运维流程，不是把一般业务规则搬出 Module 的理由。现有种子是非生产工具，本轮不修改其业务含义或自动执行它们。

## 6. 自动护栏

运行 pnpm architecture:check。新增规则：

| Rule                            | 检查                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| thin-entrypoint                 | App main/index、工具 cli 和根 package scripts 指向的 TS 入口只有 startup import/call |
| composition-no-handlers         | App bootstrap/app 与模块装配工厂不能内联 HTTP handler                                |
| no-persistence-in-orchestration | 装配、Domain、Application、API 不直接执行常见 SQL builder 操作                       |
| server-layer-boundary           | 服务端分层不能向基础设施或外层反向导入                                               |
| page-workflow-boundary          | 模块 Vue pages 不直接导入 client/api-client                                          |
| workflow-outside-boundary       | 页面/装配不直接调用 fetch 或已识别模块 client                                        |
| module-no-process-env           | 模块通过注入获得配置，不读取 process.env                                             |
| source-controlled-ui            | package 与 authored source 不引入 `@soybeanjs/ui` styled 包                          |
| ui-private-import               | `#ui/*` 私有 alias 不泄漏到 `@jingwei/ui` 之外                                       |

检查 authored TS/Vue script，排除测试、generated、dist 和 node_modules。TypeScript AST 避免将模板文本、注释或普通字符串误认为代码。Application/API 可 type-only 引用明确的 TenantDirectory/TenantSnapshot/AppConfig 契约，但不能因此导入 DatabaseRuntime/Kysely 实现。

规则并不证明任意包装函数都没有副作用，不能因为检查通过就认为职责正确。新增入口命名/执行形式、动态导入方式、平台端口时，需要一起更新识别逻辑和正反例。

## 7. Review 检查表

- 从入口能否一眼看出启动意图？
- bootstrap 是否只选择实现，而没有复制功能分支？
- 每组状态是否只有明确的拥有者？
- 不同变化原因（规则、HTTP、数据、显示）是否可以独立修改和测试？
- import 一个实现模块是否意外启动 I/O 或修改全局状态？
- 谁创建资源，谁处理失败并释放？
- 有没有为了缩短文件而新增无意义转发层或万能 helper？
- 行为测试、架构规则、README 和系统文档是否同步？
