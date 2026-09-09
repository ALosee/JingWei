# OpenAPI tooling

`pnpm api:generate` 从模块显式导出的 OpenAPI route contract 生成模块自有的 `paths` 类型：

```text
packages/modules/<module>/src/client/generated/openapi.ts
```

contract 同时供 Hono 请求校验与运行时 OpenAPI 文档使用；生成器只读取 `contracts.ts` 的显式注册项，不扫描或执行任意仓库文件。生成文件禁止人工编辑。

`pnpm api:check` 不写文件，只验证已提交的生成类型与 contract 完全一致；根 `pnpm check` 会执行这一项。

新增有 HTTP API 的模块时：

1. 在模块 `server/api/openapi.ts` 定义并导出 contract；
2. 在 `src/contracts.ts` 显式注册；
3. 执行 `pnpm api:generate`；
4. 在模块 client 中通过 `@soybeanjs/fetch/openapi` 使用生成的 `paths`。
