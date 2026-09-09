# ADR 0009: OpenAPI Contract and Soybean Fetch

- Status: Accepted
- Date: 2026-09-08

## Context

现有前端 `requestJson` 只覆盖带 Cookie 的 JSON 请求、成功响应 Zod 校验和基础服务端错误映射。URL、CSRF Cookie 读取和请求体序列化仍散落在模块客户端，缺少超时、网络错误、取消、非 JSON 错误与 `204` 的统一语义。后端契约只维护在手写 Markdown 中，Hono 请求校验、文档和前端类型没有共同事实源，容易漂移。

项目主要采用 Soybean 生态。`@soybeanjs/fetch` 当前为 `0.1.0`，但已具备 Fetch transport/business hook 分层、超时、重试、Standard Schema 验证和 OpenAPI typed client。项目接受其 0.x 阶段的版本风险，但不能让业务模块直接依赖不稳定细节。

## Decision

模块在 `server/api/openapi.ts` 使用 Zod 与 `@hono/zod-openapi` 定义 route contract。相同 contract 同时驱动 Hono 请求校验、OpenAPI 3.1 文档和客户端 `paths` 类型生成；handler 仍保持 thin，只调用 Application Use Case 并映射响应。

Server 在 `/openapi/v1.json` 暴露机器可读契约，在 `/docs` 使用 Scalar 提供交互式文档。文档明确 Cookie Session、CSRF Header、成功状态与统一错误响应。手写 `docs/http-api.md` 保留协议语义、流程和错误处理说明，不重复承担字段级事实源。

`tooling/openapi` 通过显式 contract registry 调用 `openapi-typescript`，把生成类型写入各模块自己的 `src/client/generated/openapi.ts`。生成文件不得人工编辑；`pnpm api:check` 检查漂移并进入根质量门禁。平台包不得持有汇总所有模块的 Mega `paths` 类型。

前端以 `@jingwei/api-client` 作为唯一 transport composition boundary：

- 内部固定使用 `@soybeanjs/fetch` 的单一 `createRequest` 实例；业务模块通过 `createModuleApiClient<paths, prefix>()` 获取 module-scoped typed client；默认 `client` 使用 `toFlatTypedClient` 返回 `{ data, error }`，只有应用启动等明确 fail-fast 的流程使用显式 `throwingClient`；
- Cookie 凭据、JSON Accept、浏览器 `no-store`、30 秒默认超时和双提交 CSRF Header 在 transport hook 统一处理；
- 请求实例的 `onLoadingChange` 与 `onGlobalLoadingChange` 是 HTTP loading 的事实源。Vue composable 通过 `@jingwei/api-client/vue` 的并发安全适配器消费它，页面和业务流程不得用 `try/finally` 手工维护请求 loading；
- 默认重试次数为 0，尤其不透明重放修改请求；需要重试的幂等操作必须在调用点显式配置；
- 不启用内置 response cache、dedupe、Bearer token refresh 或业务 code envelope。服务端状态缓存由未来确有需求时引入的 Pinia Colada query 层负责；
- 每个模块调用仍传入模块拥有的 Zod response schema，运行时不信任仅由 OpenAPI 生成的 TypeScript 类型；
- Fetch/HTTP/schema 失败统一转换为 `ApiClientError`，无 HTTP 响应时 `status` 为 `null`，服务端结构化错误保留稳定 `code`、`requestId` 与安全 `details`。

固定使用精确版本 `@soybeanjs/fetch@0.1.0`，并只在平台边界直接导入它。升级前运行请求层、模块类型、OpenAPI 漂移和完整质量门禁测试。

## Alternatives

- Hono RPC：同仓类型体验直接，但不能单独解决标准 OpenAPI 文档与跨语言消费；全平台 AppType 还会破坏模块边界。
- Alova：请求与状态管理能力完整，但与当前平台所需能力重叠较多，并增加另一套 method/cache 心智模型。
- Pinia Colada 作为请求层：适合 Vue server-state，但不负责通用 transport、OpenAPI 文档或后端 contract；保留为未来按页面需求引入的上层能力。
- TanStack Query/Vue Query：生态成熟，但当前页面尚无足够复杂的缓存、失效和预取需求，不提前引入。
- 继续手写 Markdown 与 `requestJson`：依赖最少，但无法可靠阻止文档、请求校验与前端类型漂移。

## Consequences

新增或修改接口必须先更新模块 route contract、handler 与响应 schema，再运行 `pnpm api:generate`。OpenAPI handler 类型会在编译期检查声明状态与返回体，浏览器边界会在运行时再次校验响应。模块客户端不再手写 URL 编码、JSON 序列化或 CSRF Cookie 读取。交互流程显式判断扁平结果的 `error`，成功和预期失败保持在同一控制流；请求生命周期状态不再由各页面重复实现。

仓库新增 Scalar、`@hono/zod-openapi`、`openapi-typescript` 和 `@soybeanjs/fetch` 依赖，并承担其升级成本。OpenAPI 只能描述外部可观察契约，不能替代 Application/Domain 测试、授权实现或手写流程文档。Pinia Colada 不在本 ADR 中成为默认依赖；出现明确 server-state 场景时再独立评估。
