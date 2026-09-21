# `@jingwei/audit`

平台审计写入契约和 PostgreSQL 实现。审计回答“谁在何时、哪个租户和请求中，对哪个业务对象执行了什么，结果如何”，并区分租户用户与平台控制面 actor。

## 公共 API

### `AuditEntry`

| 字段                      | 含义                              |
| ------------------------- | --------------------------------- |
| `context`                 | requestId、tenantId、actor userId |
| `module` / `action`       | 动作所有者和稳定动作标识          |
| `entityType` / `entityId` | 被操作业务对象                    |
| `result`                  | `SUCCESS` 或 `FAILURE`            |
| `before` / `after`        | 可选且已脱敏的变化快照            |
| `ipAddress` / `userAgent` | 可选协议来源信息                  |

### `AuditWriter.append(entry)`

模块依赖的写入端口。`PostgresAuditWriter` 将记录追加到 `platform.audit_log`，使用注入的时间函数便于测试。

### `PostgresPlatformAuditWriter.appendPlatform(entry)`

用于租户生命周期等控制面动作。actor 明确为 `PLATFORM_OPERATOR | CLI | SYSTEM`，目标 tenantId 独立记录；禁止用虚构的租户 UserId 代替平台操作者。
HTTP 控制面会把经过可信代理策略解析的客户端 IP 与有界 User-Agent 放进 `PlatformAuditContext`；登录成功、失败、退出以及租户管理动作均沿用该元数据。未知账号登录失败只记录固定目标与失败类别，不保存攻击者提交的账号原文。

```ts
await audit.append({
  context,
  module: 'organization',
  action: 'organization.rename',
  entityType: 'organization',
  entityId,
  result: 'SUCCESS',
  before: { name: oldName },
  after: { name: newName },
})
```

## 与日志、事件的区别

| 机制              | 主要用途                 | 是否可因日志级别关闭 |
| ----------------- | ------------------------ | -------------------- |
| 运行日志          | 诊断性能和故障           | 可以过滤             |
| 审计              | 合规、追责、业务操作历史 | 不应关闭             |
| Integration Event | 通知其他模块事实         | 不作为审计记录替代品 |

存在真实事件消费者时，同一个动作可能同时产生日志、审计和 outbox，但三者载荷和保留策略不同。当前 Foundation 的模块写操作不生产 Outbox 事件。

## 事务一致性

高价值写操作的审计应与业务数据共享事务。`PostgresAuditWriter` 接收 QueryExecutorProvider（Kysely 或 Transaction 均可），通过同一个 executor 建立审计表的类型视图，不新建连接或提交事务。用例中使用 `new PostgresAuditWriter(transaction)`，即可与模块仓储原子提交；未来启用的 Outbox 也必须复用该事务。不能先提交业务数据，再异步“尽力写审计”。Navigation 的真实数据库测试会注入 Audit 失败，验证业务状态与发布指针一起回滚。

## 敏感信息

`before`/`after` 不接受原始请求体。写入前必须：

- 移除密码、摘要、Token、Secret；
- 避免存储不必要的完整个人信息；
- 限制大对象和二进制内容；
- 对失败结果避免记录攻击载荷原文；
- 通过专用权限控制审计查询和导出。

## 迁移与所有权

`@jingwei/audit/migrations` 创建平台审计表。业务模块拥有 action 命名和调用时机，平台包拥有存储契约。审计记录按租户隔离，跨租户查询只能出现在受控运维/合规入口。
