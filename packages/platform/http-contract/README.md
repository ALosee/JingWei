# `@jingwei/http-contract`

平台 HTTP 协议中与具体业务模块无关的稳定契约。

## 公共 API

- `apiErrorSchema`：统一错误响应 `{ code, message, requestId, details? }` 的 Zod schema；服务端响应中的 `requestId` 必须存在。
- `ApiError`：由 schema 推导的错误响应类型。
- `openApiSecurityNames`：租户与平台控制面各自的 OpenAPI Cookie Session、Refresh 与 CSRF Header 安全方案稳定名称。

模块只在自己的 OpenAPI contract 中组合这些基础契约；本包不保存业务 DTO、路由或 handler，也不依赖 Hono。
