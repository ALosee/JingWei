# 开发指南

本文给出从本地启动到交付一个模块变更的标准路径。概念不清楚时先读 [Edition 与 Module 手册](./edition-module-handbook.md)，运行机制见 [运行时生命周期](./runtime-lifecycle.md)。

## 1. 本地准备

### 1.1 依赖

- Node.js：使用仓库约定的活跃 LTS 版本；
- pnpm：使用根 `package.json` 声明的包管理器版本；
- Docker / Docker Compose：运行 PostgreSQL；
- Chrome：仅在使用 `PLAYWRIGHT_CHANNEL=chrome` 执行浏览器测试时需要。

### 1.2 首次启动

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d postgres
pnpm edition:generate development
pnpm migration:up
DEV_ADMIN_PASSWORD='<至少 12 个字符>' pnpm seed:dev
pnpm seed:navigation
pnpm dev
```

根脚本是规范入口。不要在不同成员的个人脚本中重新实现 Edition 生成、迁移顺序或启动流程。

### 1.3 环境文件与启动模式

所有环境文件都放在仓库根目录。启动命令与读取范围如下：

| 命令            | Server 读取                                                        | Web/Vite mode | 用途                   |
| --------------- | ------------------------------------------------------------------ | ------------- | ---------------------- |
| `pnpm dev`      | `.env`、`.env.local`、`.env.development`、`.env.development.local` | `development` | 日常开发               |
| `pnpm dev:test` | `.env.test`                                                        | `test`        | 使用测试配置做本地联调 |

`.env.test` 不会被普通 `pnpm dev` 自动读取。这种隔离可以避免测试数据库、测试来源或更短的会话配置意外进入日常开发进程。若配置写在 `.env.test`，修改后应以 `pnpm dev:test` 重启；若希望继续使用 `pnpm dev`，则把本机覆盖项放入不提交的 `.env.development.local`。

数据库迁移、开发种子等一次性命令不是 Vite/Server 子进程，不会因文件存在而自动读取 `.env.test`。运行这类命令时应由终端或部署系统显式注入环境变量；不要把密码提交到仓库。

使用 `.env.test` 的完整迁移/导航初始化命令见 [迁移工具](../tooling/migration/README.md#显式使用-envtest)。已有用户不要为了初始化导航重复 seed:dev；seed:navigation 不修改密码，只初始化开发角色/导航授权，并保留已发布配置。

### 1.4 Lint、格式化与导入排序

ESLint 负责严格 TypeScript、Vue 模板正确性和代码约定；Oxfmt 负责排版和导入排序。根 `.oxfmtrc.json` 是统一格式来源：两空格、单引号、无分号、允许尾逗号、参考行宽 100、LF 换行。Markdown 保留正文的手动换行。

```bash
pnpm lint          # 只检查代码质量，任何 warning 都失败
pnpm lint:fix      # 修复可自动修复的 lint 问题
pnpm format        # 格式化手写文件并排序导入
pnpm format:check  # 只检查格式，供 CI 和提交前使用
pnpm check         # 完整质量门，包含格式检查和生产构建
```

导入按 Node 内置模块、第三方包、`@jingwei/*` 工作区包、相对路径、样式导入分组，组间空一行，组内按来源升序排列。类型导入跟随来源分组，继续由 ESLint 要求使用 `import type`。副作用导入保留顺序；注释作为排序分界，不跨注释重排。不要另开编辑器的 Organize Imports 或 ESLint 导入排序规则。

格式化覆盖 TS/JS、Vue、CSS、JSON、YAML、Markdown 和 HTML 等支持的手写文件。`generated`、`_generated`、`pnpm-lock.yaml`、依赖目录、构建和测试产物被排除；修改生成物应修改其来源。Oxfmt 不重排 `package.json` 字段，避免改变有序配置的含义。

VS Code/Cursor 打开仓库根目录后，安装 `.vscode/extensions.json` 推荐的 ESLint、Oxc 和 Vue 扩展。仓库配置让 Oxfmt 在保存时格式化，ESLint 执行代码修复，并关闭 Oxc 扩展中的 Oxlint。其他编辑器使用项目内的 Oxfmt 和根配置，不依赖个人全局版本。`.editorconfig` 提供通用缩进和换行约定。

Oxfmt 是唯一新增的格式化依赖：现有 ESLint 无法统一排版上述多种文件，Oxfmt 同时提供导入排序，无需额外排序插件。版本固定在 pnpm catalog；升级时审查格式差异并运行完整质量门。Oxfmt 当前的 Vue、HTML、Markdown 支持内部使用其捆绑的 Prettier，不需要单独安装或配置 Prettier。

首次格式化与功能修改分开审查；日常修改可先运行 `pnpm lint:fix`，再运行 `pnpm format`。CI 只检查，不自动改写源码。

## 2. 先判断变更属于哪里

| 变更                           | 首选位置               |
| ------------------------------ | ---------------------- |
| 用户、会话、权限、数据范围     | `modules/iam`          |
| 菜单、页面来源、路由解析       | `modules/navigation`   |
| 组织树与组织查询               | `modules/organization` |
| 字典类型与条目                 | `modules/dictionary`   |
| 跨业务复用且不含业务语义的能力 | `platform/*`           |
| 产品组合差异                   | `editions/*`           |
| 进程装配、HTTP 容器和前端壳    | `apps/*`               |
| 构建、迁移、生成和架构检查     | `tooling/*`            |

如果一个能力有明确业务所有者，就不应为了“复用”下沉到 platform。platform 只承载稳定、通用、没有单一业务归属的机制。

位置确定后还要区分职责：[入口/装配/流程/规则/适配器/页面](./code-structure.md)。main/index/cli 只导入并调用启动函数；bootstrap/module factory 选择实现，不实现功能分支；状态和规则留在明确所有者处。不要用“已经提取成函数”代替职责检查。

## 3. 完成一次普通模块变更

建议按以下顺序工作：

1. 在模块 README 中确认职责和非职责；
2. 修改领域类型、规则或用例；
3. 通过模块内部端口连接数据库或外部能力；
4. 在 `server/module.ts` 装配服务和路由，handler 实现放在 `server/api/`；
5. 在模块 typed client 中封装 HTTP 调用；
6. 在 `web/module.ts` 声明页面绑定；页面组合模块 composable，由后者拥有网络流程和提交状态；
7. 需要时更新 manifest 的 capability、permission 或 dependency；
8. 数据结构变化时新增迁移，不修改已发布迁移；
9. 增加对应层级的测试；
10. 更新模块 README、HTTP/API 文档和 ADR（若改变架构决策）；
11. 运行根级质量命令。

## 4. 创建新模块

### 4.1 生成骨架

优先使用仓库模块生成器，避免遗漏标准入口：

```bash
pnpm module:create <module-code>
```

生成后至少应包含：

```text
modules/<module-code>/
├── migrations/
├── src/
│   ├── client/index.ts
│   ├── manifest.ts
│   ├── server/              # module、api、application、domain、infrastructure、public
│   ├── shared/index.ts
│   └── web/                 # module、pages、components、composables
├── README.md
├── package.json
└── tsconfig.json
```

### 4.2 定义边界

在写实现前回答：

- 模块拥有哪些业务事实和表？
- 明确不拥有什么？
- 对外同步 API 是什么？
- 会发布或消费哪些事件？
- 依赖哪些模块，为什么不能通过事件解耦？
- 它提供哪些 capability 和 permission？
- 是否包含可独立展示的页面？
- 租户隔离与数据范围怎样生效？

这些答案写入模块 README，而不是只存在于作者脑中。

### 4.3 接入 Edition

把模块加入某个 Edition 的根模块前，确认它确实是产品差异，而不是另一个模块遗漏的依赖。然后执行 Edition Builder，检查生成的 server/web 模块列表和迁移列表。

## 5. Manifest 变更规则

### module code

module code 是持久的技术标识，会出现在依赖、Edition、权限、生成产物和运维信息中。发布后不要为了展示名称改变它。

### dependency

只有需要同步调用或启动期契约时才声明依赖。仅仅订阅事件不意味着必须形成同步依赖边。

### capability

capability 回答“当前产品是否具备某项能力”。它可被 Edition、导航和前端功能开关使用。

### permission

permission 回答“当前主体是否被允许执行某项动作”。服务端用例必须检查它；前端隐藏按钮只改善体验。

## 6. 数据库变更

### 6.1 原则

- 每张业务表有唯一模块所有者；
- 所有租户数据查询显式包含租户范围；
- 新迁移只向前，不重写已在环境中执行的历史文件；
- 先设计兼容的扩展/回填/收缩步骤，再考虑删除列或改变语义；
- 一个业务事务中的状态、审计和 outbox 尽量使用同一连接。

### 6.2 迁移流程

1. 在模块 `migrations/` 新增有序 SQL 文件；
2. 更新模块迁移映射；
3. 生成目标 Edition；
4. 在空数据库执行一次；
5. 在带旧结构和样例数据的数据库执行升级；
6. 验证重复运行不会破坏迁移记录；
7. 记录回滚或向前修复策略。

## 7. HTTP 与前端变更

### 服务端

- 路由只做协议解析、身份/权限入口和结果映射；
- 业务规则放在领域/用例，不放进 Hono handler 或组合根；
- 输入从 `unknown` 开始验证；
- 错误使用稳定 code；
- 查询和写入均带 `ApplicationContext`；
- 修改请求通过 CSRF 与 Origin 保护。

### 客户端

- 每个模块在自己的 `client/` 封装 typed API；
- 页面组件通过模块 `web/composables/` 调用 API；URL、Cookie 与错误协议留在 client，提交状态和流程留在 composable；
- 导航结果决定展示，不替代服务端授权；
- 登录恢复完成前应有明确 loading 状态，避免闪现受保护页面。

## 8. 跨模块协作

允许的三种方式：

1. 导入目标模块的 `public` 契约，由组合根注入实现；
2. 发布 Integration Event，由 outbox 保证与业务事务一致；
3. 把真正通用、无业务所有者的技术机制放到 platform。

禁止：

- 读取其他模块的表；
- 深层导入其他模块的 `domain`、`application`、`infrastructure` 文件；
- 通过字符串 token 暗中建立未声明的依赖；
- 让循环同步依赖通过延迟导入“勉强工作”。

## 9. 文档要求

每个可交付变更至少检查：

- 模块 README 是否仍准确；
- 新/改 HTTP 接口是否更新 [HTTP API 手册](./http-api.md)；
- 新/改公共 TypeScript 接口是否更新 [公共 API 参考](./api-reference.md)；
- 配置和部署变化是否更新 [运维手册](./operations.md)；
- 新概念是否加入 [术语表](./glossary.md)；
- 架构方向或不可逆取舍是否新增 ADR。

注释优先解释约束、原因、所有权和失败语义。能由类型和函数名直接看出的代码，不需要逐行翻译式注释。

## 10. 提交前检查

```bash
pnpm check
pnpm build
pnpm test:e2e
```

按变更风险补充：

- 数据库变更：空库和升级迁移测试；
- 身份/权限变更：未登录、无权限、跨租户和 CSRF 测试；
- Edition 变更：检查生成产物不包含未选模块；
- 导出变更：对所有调用方执行类型检查；
- 运维变更：验证生产构建启动与 `/health`。
- 结构重构：保留行为回归测试，验证导入无启动副作用、资源清理顺序，并为新增架构规则补合法/非法用例。
