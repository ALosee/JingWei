# `@jingwei/kernel`

平台最底层的稳定类型与原语。它不依赖任何业务模块，为所有层提供统一的 ID、上下文、错误、时间和分页契约。

## 导出

| API                          | 作用                                    |
| ---------------------------- | --------------------------------------- |
| `Clock` / `systemClock`      | 可替换的时间来源                        |
| `ApplicationContext`         | 一次操作的 request、tenant、user 上下文 |
| `AuthContext`                | 在应用上下文上增加 session 和 role 信息 |
| `ApplicationError`           | 可被 HTTP 边界稳定映射的应用失败        |
| `DomainError`                | 领域规则拒绝，默认状态 `422`            |
| `ApiErrorBody`               | 服务端错误 JSON 契约                    |
| `new*Id`                     | 生成 UUIDv7 品牌 ID                     |
| `to*Id`                      | 验证外部字符串并转换为品牌 ID           |
| `PageRequest` / `PageResult` | 跨模块一致的分页形状                    |

## ID 约定

所有平台实体 ID 使用 UUIDv7，并通过 TypeScript brand 防止不同实体 ID 被误传：

```ts
const tenantId = toTenantId(input.tenantId)
const requestId = newRequestId()
```

`to*Id` 是运行时验证边界；类型断言 `value as TenantId` 会绕过验证，业务代码禁止这样做。调用方也不得根据 UUID 的时间位推导业务时间。

## 上下文约定

上下文由 HTTP、任务或测试组合边界创建并显式传给用例。不要用全局变量或异步局部存储隐藏租户/用户依赖，除非未来经过独立 ADR 采用统一机制。

`ApplicationContext` 表示已确认的业务主体，因此匿名请求不应伪造默认用户。需要匿名上下文时，在协议层保持 `AuthContext | null`。

## 错误约定

稳定程序逻辑使用 `code`，展示使用 `message`。`details` 只能包含可安全返回给客户端的信息；内部 cause 通过 `Error.cause` 进入日志链路。

```ts
throw new ApplicationError({
  code: 'RESOURCE_NOT_FOUND',
  message: '资源不存在',
  status: 404,
})
```

不要为编程错误或数据库驱动异常随意包装一个 `400`；未知错误应交给最外层统一记录和归一化。

## 时间与测试

领域和应用代码注入 `Clock`，生产使用 `systemClock`。固定时钟由 `@jingwei/testing` 提供。这样可以稳定测试过期、重试、审计和事件时间。

## 依赖规则

- kernel 不得依赖 Hono、Vue、Kysely 或业务模块；
- 只加入足够稳定、跨多数模块成立的原语；
- 含业务名称或业务状态的类型留在所属模块；
- 修改导出前运行全仓库类型检查，因为影响面通常最大。
