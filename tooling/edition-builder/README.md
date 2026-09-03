# `@jingwei/edition-builder`

发现业务模块、解析 Edition 依赖闭包，并生成 Server、Web、迁移和路由工具所需入口。它是物理模块裁剪的核心构建步骤。

## 运行

```bash
pnpm edition:generate development
pnpm edition:generate full
```

未指定 Edition 时默认 `development`。

`src/cli.ts` 只调用 `commands/generate.ts` 的 `runEditionCommand()`；后者处理 argv、仓库路径与输出，生成实现仍由 `generateEdition` 拥有。导入命令或生成器不会立即生成文件，调用者必须显式执行函数。

## 发现规则

`discoverModules(repositoryRoot)` 扫描 `packages/modules/*`：

- 每个子目录必须有 `src/manifest.ts`；
- 文件必须导出 `manifest`；
- manifest id 必须与目录名一致；
- 返回结果按 module id 稳定排序。

模块发现不依赖手写中央清单，新增目录后能自动进入 catalog；是否进入产品仍由 Edition 决定。

## 生成流程

`generateEdition(root, name)`：

1. 加载 `editions/<name>.ts` 的默认导出；
2. 发现全部 manifests；
3. 调用 `resolveEdition` 计算依赖优先列表和 capability；
4. 生成 Server ResolvedEdition；
5. 生成 Server Module 安装列表；
6. 合并 platform 与选中模块迁移；
7. 生成 Web Module 列表；
8. 生成 Elegant Router 页面目录和安全占位 imports。

## 生成文件

| 文件 | 消费者 |
| --- | --- |
| `apps/server/src/generated/edition.ts` | `ModuleRegistry` |
| `apps/server/src/generated/modules.ts` | Server 模块安装 |
| `apps/server/src/generated/migrations.ts` | migration CLI |
| `apps/web/src/generated/modules.ts` | 动态页面注册 |
| `apps/web/src/generated/elegant-router.ts` | 路由页面目录 |
| `apps/web/src/router/_generated/imports.ts` | Elegant Router 运行前安全占位 |

所有文件带 `GENERATED ... DO NOT EDIT` 头。生成器只有内容变化时才写文件，减少 watch 和构建抖动。

## 物理裁剪

生成入口只 import 已解析模块。Bundler 从这些入口做可达性分析，因此未选模块不应进入生产制品。验证不能只看生成数组，还要检查最终 bundle 或构建 metafile。

Platform 的 database/auth/audit/outbox 迁移当前始终加入 Server 迁移集合；业务模块迁移只随 Edition 加入。

## 公共 API

- `discoverModules(root)` / `DiscoveredModule`；
- `generateEdition(root, editionName)`，成功返回 `ResolvedEdition`。

API 会加载本地 TypeScript 文件，因此只应对可信仓库执行，不能用来加载用户上传的 manifest。

## 修改检查表

- 生成顺序稳定且依赖优先；
- Server/Web/migrations 来自同一解析结果；
- 内容未变不触发写入；
- 路径兼容 module kebab-case；
- development/full 都能生成、类型检查和构建；
- 未选模块不会进入 bundle；
- 新生成文件记录在本 README 并带禁止手改头。
