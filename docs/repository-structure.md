# Repository Structure

仓库采用单一 Git Monorepo：

```text
apps/
  web/                 Vue App Shell 与 Composition Root
  server/              Hono 进程、HTTP Composition Root
packages/
  platform/            跨业务模块且稳定的平台能力
  modules/             完整 Vertical Slice 模块
editions/              TypeScript Edition Definitions
tooling/
  edition-builder/     解析模块 DAG 并生成静态 registries
  architecture-check/  强制边界
  migration/           运行生成后的 Kysely migrations
  module-generator/    创建规范模块骨架
docs/                  架构与 ADR
```

## Package 原则

- scope 固定为 `@jingwei/*`；内部依赖使用 `workspace:*`，公共依赖版本由 pnpm catalog 集中管理。
- 全仓 ESM、strict TypeScript；不得启用 decorator metadata。
- `apps/server/src/generated/` 与 `apps/web/src/generated/` 由 Edition Builder 生成，不允许人工修改。
- server `index.ts` 只调用启动函数；`bootstrap/` 负责资源与进程装配，`app.ts` 注册已定义的 middleware、系统路由、错误处理和生成模块；具体模块自己拥有 Hono Sub-App。
- web App Shell 只组合启用模块、布局、页面注册表和动态导航，不了解模块内部页面实现。
- web `main.ts` 只调用启动函数；`bootstrap/` 选择实现，`navigation/` 拥有导航启动流程与首屏规则。
- tooling 可执行入口只调用 `commands/` 的具名函数，库的 index.ts 不受可执行入口限制。

详细分工和自动检查见 [代码职责与入口约束](./code-structure.md)。不要用文件行数代替职责判断。

## Platform packages

- `kernel`：ID、Context、Clock、错误、分页等稳定基础类型。
- `config`：启动时 Zod 校验并冻结环境配置。
- `database`：PostgreSQL pool、Kysely view、transaction/migration infrastructure 和 platform tenant/number sequence 数据。
- `auth`：密码、server-side session、cookie/origin/CSRF 基础设施。
- `observability`：结构化日志、Request ID 与日志上下文。
- `audit`：append-only audit port 与 PostgreSQL adapter。
- `outbox`：未启用的 Integration Event envelope、writer/worker primitive；首个真实消费者出现时再接入运行时。
- `storage`：可替换 ObjectStorage port；本轮不绑定具体云厂商。
- `module-sdk`：`defineModule`、`defineEdition`、DAG/Capability 验证和 runtime contracts。
- `api-client`：浏览器端统一 fetch/error contract 基础。
- `testing`：跨 package 的测试 builders/fakes。
- `ui`：Design Token、布局与最小平台组件。

## Module package

模块结构固定：

```text
src/
  manifest.ts
  shared/
  server/
    domain/
    application/
    infrastructure/
    public/
    api/
    module.ts
  client/
  web/
    pages/
    components/
    composables/
    module.ts
migrations/
README.md
package.json
```

每个模块仅导出 manifest、shared、server、server/public、client、web 与 migrations 等明确入口。创建模块使用 `pnpm module:create <name>`，不得把复制旧模块作为主要流程。
