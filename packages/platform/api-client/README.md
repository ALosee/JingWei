# `@jingwei/api-client`

Web 模块共享的安全 JSON 请求边界。它统一携带 Cookie、验证成功响应，并把服务端错误转换为稳定异常。

## 公共 API

### `requestJson({ input, init, schema })`

行为：

1. 默认发送 `Accept: application/json`；
2. 使用 `credentials: 'include'` 携带同源/允许的会话 Cookie；
3. 解析 JSON；
4. 非 2xx 响应转换为 `ApiClientError`；
5. 成功响应通过传入的 Zod schema 做运行时验证；
6. 返回 `z.infer<typeof schema>`。

```ts
const session = await requestJson({
  input: '/api/v1/iam/session',
  schema: sessionStatusSchema,
})
```

与单纯 `fetch<T>` 不同，这里的泛型来自实际 schema，因此服务端返回不兼容 JSON 会在边界立即失败。

### `ApiClientError`

包含：

- `code`：稳定服务端错误码或 `UNEXPECTED_RESPONSE`；
- `message`：可展示/进一步本地化的消息；
- `requestId`：排障关联 ID，响应缺失时为 `null`；
- `status`：HTTP 状态。
- `details`：可选 unknown，由具体模块再次校验后使用；例如导航配置的 issues，不直接断言为可信结构。

页面根据 `code` 或 `status` 决定流程，不匹配 message 文本。向用户展示未知错误时可同时提供 requestId。

## 模块客户端约定

页面不应直接调用 `requestJson` 拼业务 URL。每个业务模块在自己的 `src/client` 中：

- 定义响应 schema；
- 封装 URL、method、body 和 CSRF 头；
- 导出业务语义函数，例如 `getCurrentSession()`；
- 在返回前完成协议到页面模型的转换。

这样 HTTP 版本变更不会散落在组件中。

## 边界和限制

- 当前实现假设所有响应都有 JSON；`204` 或文件下载需要专用客户端函数；
- JSON 解析失败会抛原生异常，不伪装成业务错误；
- 本包不负责自动刷新会话或重试修改请求；
- CSRF token 仍需模块客户端按平台常量显式加入；
- 不对非幂等请求做透明重试，避免重复副作用。
