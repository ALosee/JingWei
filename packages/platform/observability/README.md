# `@jingwei/observability`

Jingwei 的结构化应用日志抽象和 Pino 实现。业务与模块依赖 `AppLogger`，不直接耦合 Pino API。

## 公共 API

| API | 作用 |
| --- | --- |
| `LogContext` | 结构化日志字段，只读键值对象 |
| `AppLogger` | `child/debug/info/warn/error` 的最小日志端口 |
| `createLogger({ environment })` | 创建生产可用的 Pino 适配器 |

```ts
const requestLogger = logger.child({ requestId, module: 'iam' })
requestLogger.info({ userId }, 'session.created')
```

固定字段放 child context，单次动作字段放方法 context，消息使用稳定、短小的事件式名称。

## 默认行为

- production 最低级别为 `info`；其他环境为 `debug`；
- 基础字段包含 `service: jingwei-server`；
- 默认脱敏路径包括 password、passwordHash、token、sessionToken、secret；
- 输出为结构化 JSON，供日志平台解析。

脱敏字段匹配不是记录敏感信息的许可证。载荷在进入 logger 前就应最小化；新增敏感字段名时同步扩展脱敏策略。

## 字段约定

推荐字段：`requestId`、`tenantId`、`userId`、`module`、`code`、`durationMs`、`status`、`workerId`、`eventType`。

- 不把这些值拼进 message；
- 不用高基数字段做无约束指标标签；
- error 日志记录安全的 error message/cause，客户端响应只带 requestId；
- 用户可控长文本应截断或摘要化。

## 日志级别

- `debug`：本地诊断和详细流程；
- `info`：正常生命周期和高价值操作完成；
- `warn`：可恢复异常、重试或降级；
- `error`：当前操作失败、需要调查或告警。

预期的认证失败通常不是服务错误，不应每次都记 error；但异常频率可通过安全指标检测。

## 非职责

本包目前不提供 tracing、metrics、日志传输或审计查询。未来加入这些能力时保持 `AppLogger` 兼容，并在组合根接入 exporter。审计请使用 `@jingwei/audit`。
