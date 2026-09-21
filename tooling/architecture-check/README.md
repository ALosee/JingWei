# `@jingwei/architecture-check`

把 Jingwei 的模块边界与代码职责转化为可执行检查。模块检查读取 package、manifest 与源码；职责检查覆盖 apps、packages、tooling 的手写 TypeScript 和 Vue script。设计依据见 [ADR 0008](../../docs/adr/0008-thin-entrypoints-and-owned-workflows.md)。

## 运行

```bash
pnpm architecture:check
```

无问题时输出 `Architecture check passed`；违规时逐行输出文件、rule 和说明，并以非零状态退出。

## 当前规则

| Rule                               | 阻止的问题                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `strict-exports`                   | package 使用 `./*` 暴露全部内部文件                                                             |
| `no-cross-module-relative-import`  | 相对路径越过模块目录                                                                            |
| `unknown-module-package-reference` | 引用未被发现的业务模块包                                                                        |
| `no-private-module-import`         | 导入另一个模块的 `src/*`                                                                        |
| `cross-module-public-api-only`     | 跨模块导入 server/web/migrations 等运行时内部入口                                               |
| `web-cannot-import-server`         | Web 源码引入服务端实现                                                                          |
| `server-cannot-import-web`         | Server 源码引入 Web 实现                                                                        |
| `manifest-dependency-required`     | package/import 依赖没有在 manifest 声明                                                         |
| `module-database-ownership`        | 模块访问另一个模块拥有的 PostgreSQL schema                                                      |
| `thin-entrypoint`                  | 应用 main/index、工具 cli 和根 scripts 指定的 TS 工具入口包含内联流程，而非仅导入并调用启动函数 |
| `composition-no-handlers`          | App bootstrap/app、模块 server/module 或 public/create-* 工厂内联 HTTP handler                  |
| `no-persistence-in-orchestration`  | 装配、Domain、Application、API 调用常见 SQL builder 方法                                        |
| `server-layer-boundary`            | Domain/Application/API 反向导入基础设施或外层实现                                               |
| `page-workflow-boundary`           | 模块 pages 直接导入 module client 或 api-client                                                 |
| `workflow-outside-boundary`        | 页面或装配直接执行 fetch / 已识别的 module client 调用                                          |
| `module-no-process-env`            | 模块自行读取 process.env，而非接收显式配置                                                      |
| `source-controlled-ui`             | package dependency 或 authored source 引入 `@soybeanjs/ui` styled 包                            |
| `ui-private-import`                | `#ui/*` 生成器 alias 被 `@jingwei/ui` 之外的源码导入                                            |
| `api-authorization-contract`       | Module OpenAPI route 绕过授权契约工厂，导致接口缺少机器可读授权声明                             |
| `platform-authorization-boundary`  | Control Plane 之外的包导入平台会话授权契约                                                      |
| `tooling-app-boundary`             | Tooling 通过相对路径穿入 app 源码，而不是消费显式 package export                                |

检查前还会把全部模块组成临时 Edition，由 `resolveEdition` 发现同步依赖环。

## 公共 API

- `checkArchitecture(repositoryRoot)`：返回全部 `ArchitectureViolation`，适合测试或其他工具调用；
- `extractImports(content)`：抽取 static import、export-from 和字面量 dynamic import。

每条 violation 包含相对文件、稳定 rule 和面向人的 message。

## 实现职责

`cli.ts` 只调用 `commands/check.ts` 的 `runArchitectureCommand()`。命令处理仓库路径、输出和退出状态；`index.ts` 编排发现与规则，不实现每一项策略。`rules/module-boundaries.ts` 保留模块边界规则，`rules/source-responsibilities.ts` 使用 TypeScript AST 检查职责，`rules/ui-foundation.ts` 检查 UI package dependency，`source-files.ts` 负责文件扫描。导入实现不会自动执行检查或设置退出码。

## 检查范围和限制

既有模块导入与数据库所有权扫描基于正则，覆盖约定的静态语法和常见 Kysely/SQL 模式；新增职责检查解析 TypeScript AST，并从 Vue 中提取 script，避免注释、模板文本、字符串造成同类误报。两者都不是完整依赖图或任意代码语义证明：变量动态 import、包装函数、别名传播、反射等仍需 review。

职责检查排除测试和 generated/_generated；所有源码扫描排除 node_modules、dist、测试产物。库的 index.ts 不当成可执行入口。Application/API 只允许 type-only 引入列举的 TenantDirectory/ActiveTenantSnapshot/AppConfig 端口，不能把这一例外扩大到 DatabaseRuntime 或 Kysely。合法装配可传入 client 函数，但不得自己调用它执行功能流程。Control Plane 的 OpenAPI contract 与 composition root 也在对应规则覆盖范围内，不能因其位于 platform package 就成为盲区。

因此：

- 新编码形式若绕过规则，应扩展检查器和测试；
- 不要把“检查器没报错”解释为任意依赖都合理；
- 规则调整要精确，避免用全局排除隐藏真正违规；
- 构建产物和 node_modules 不在扫描范围。

## 扩展规则

1. 先在架构文档/ADR 明确不变量；
2. 在对应规则文件返回稳定 rule，由 `checkArchitecture` 组合；
3. 添加最小合法/非法 fixture 测试；
4. 对现有仓库运行并分类历史问题；
5. 更新本 README 和 [测试与质量手册](../../docs/testing-quality.md)。
