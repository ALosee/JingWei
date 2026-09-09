# `@jingwei/api-client`

Web 模块共享的 HTTP transport composition boundary。内部使用 `@soybeanjs/fetch`，对模块暴露稳定的扁平 OpenAPI client、显式 fail-fast client、请求状态适配器和错误类型。

## 公共 API

### `createModuleApiClient<paths, prefix>(prefix)`

接收模块自己的 OpenAPI 生成 `paths` 与固定前缀，返回：

- `client`：基于 `toFlatTypedClient` 的默认客户端，URL、参数、body 和响应均由 OpenAPI 推断；永不抛出 HTTP 请求错误；
- `throwingClient`：需要失败立即中止流程时使用的显式客户端。

```ts
import { createModuleApiClient, toApiResult } from '@jingwei/api-client'

import { sessionStatusSchema } from '../shared/index.js'
import type { paths } from './generated/openapi.js'

const api = createModuleApiClient<paths, '/api/v1/iam'>('/api/v1/iam')

export const getSessionStatus = () =>
  toApiResult(api.client.get('/session', { schema: sessionStatusSchema }))
```

每个调用都应传入模块拥有的 Zod response schema。OpenAPI 生成类型约束编译期调用，Zod 在不可信 JSON 进入应用前执行运行时验证。

### 扁平结果与请求状态

`toApiResult()` 保持 Soybean Fetch 的 never-throwing 控制流，并将错误规范化为 `ApiClientError`：

```ts
const { data, error } = await login(input, requestState.options)
if (error) {
  showError(error.message)
  return
}
enterWorkspace(data)
```

Vue composable 使用 `@jingwei/api-client/vue`：

```ts
import { useApiRequestState } from '@jingwei/api-client/vue'

const requestState = useApiRequestState()
const submitting = requestState.loading
```

把 `requestState.options` 传给模块 client 后，`loading` 由 Soybean Fetch 的 `onLoadingChange` 自动驱动。适配器使用 pending count，多个并发请求不会因为其中一个先结束而错误地提前变为 `false`。业务 composable 不再围绕请求手写 `loading.value = true/false`。

### `ApiClientError`

| 字段        | 说明                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `code`      | 服务端稳定错误码，或平台客户端错误码                                     |
| `message`   | 安全的用户消息，可由页面进一步本地化                                     |
| `requestId` | 服务端响应或 Header 中的关联 ID；未收到响应时为 `null`                   |
| `status`    | HTTP 状态；网络、超时、取消等未形成 HTTP 响应的失败为 `null`             |
| `details`   | 通过统一错误 envelope 校验后的可选内容；模块使用前仍应按专用 schema 校验 |

客户端 code 包括 `NETWORK_ERROR`、`REQUEST_TIMEOUT`、`REQUEST_ABORTED`、`INVALID_API_RESPONSE`、`UNEXPECTED_API_ERROR` 与 `UNEXPECTED_CLIENT_ERROR`。页面按 `code` 或 `status` 决定流程，不匹配 `message` 文本。

## 平台默认值

- `credentials: 'include'`；
- `Accept: application/json`；
- 浏览器 `cache: 'no-store'`；
- 30 秒超时；
- 自动重试为 0；
- POST/PUT/PATCH/DELETE 自动从 `jingwei_csrf` Cookie 添加 `x-csrf-token`；
- 所有请求通过 `onGlobalLoadingChange` 汇总全局 loading；操作级状态使用 `useApiRequestState()`；
- Soybean Fetch 的 response cache、dedupe、Bearer auth refresh 默认不启用。

幂等查询若确需重试，可以在模块调用点显式设置并记录原因。不得透明重试修改请求。页面级缓存、失效、预取属于 server-state 层，不放进 transport；有明确需求时再引入 Pinia Colada。

## 模块边界

页面 SFC 不直接导入本包或拼 API URL。每个模块在自己的 `src/client` 中封装 typed 调用与 schema；模块 composable 调用业务语义函数，并可从 `@jingwei/api-client/vue` 获取统一请求状态。模块生成类型位于 `src/client/generated/openapi.ts`，由 `pnpm api:generate` 生成，禁止人工编辑。
