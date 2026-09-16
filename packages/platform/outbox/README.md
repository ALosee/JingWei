# `@jingwei/outbox`

事务发件箱基础设施 primitive。

> 当前状态：未启用。Server 没有装配 worker 或 dispatcher，现有模块也不写入 Outbox。迁移和公共 API 仅作为平台能力保留；首次出现具名真实消费者时，按 [ADR 0014](../../../docs/adr/0014-defer-outbox-activation-until-real-consumer.md) 完成交付链后才能生产事件。

## 为什么需要 Outbox

当系统需要可靠 Integration Event 时，如果业务事务提交后再直接发布消息，进程可能在两步之间崩溃，造成数据已变更但事件永久丢失。Outbox 先把事件作为同一事务中的数据库记录保存，再异步发布，使失败可恢复。下图是启用后的目标链路，不是当前运行时状态。

```text
业务写入 + 审计 + outbox append
              │ 同一事务
              ▼
             commit
              │
              ▼
worker claim → dispatch → mark published
```

## 公共 API

| API                             | 作用                                        |
| ------------------------------- | ------------------------------------------- |
| `IntegrationEvent<TPayload>`    | 模块发布的事实契约                          |
| `PostgresOutboxAppender.append` | 使用 Kysely/Transaction 追加事件            |
| `OutboxRepository`              | claim、成功和失败状态端口                   |
| `PostgresOutboxRepository`      | 使用 `FOR UPDATE SKIP LOCKED` 的并发实现    |
| `EventDispatcher`               | 将 outbox row 发送给进程内/外部消费者的端口 |
| `OutboxWorker.runOnce`          | 领取并分发一个批次，返回领取数量            |
| `./migrations`                  | `platform.outbox` 迁移                      |

## 事件契约

启用后的事件必须包含 tenant、type、version、aggregate、发生时间和 JSON payload。

- type 是稳定事实名；
- version 从 1 开始，破坏兼容时升级；
- payload 只包含消费者需要的最小快照；
- aggregateId 可作为顺序和幂等关联信息；
- occurredAt 来自注入时钟，不用发布时间代替；
- 不包含密码、Token 或无必要的个人数据。

## 并发与锁

启用后，`claimBatch` 在短事务中选择到期、未发布且未锁/锁已过期的记录，使用 `SKIP LOCKED` 允许多个 worker 并发。领取后记录 worker、锁时间并递增 attempts。

worker 崩溃时，超过 lockSeconds 的记录可被其他 worker 重新领取。因此消费者必须基于事件 ID 或业务幂等键处理重复消息。

## 失败与重试

启用后分发失败时：

- 保存最多 8000 字符的错误文字；
- 清理锁；
- 设置指数退避的下次时间；
- 单次最长退避 60 秒；
- 当前 worker 继续处理批次内其他事件。

未来加入死信策略时应保留原记录和人工恢复路径，不能静默丢弃达到重试上限的业务事件。

## 使用示例

以下只展示 Outbox API 的事务边界，不是当前 Organization 模块的实现。只有消费者、契约、dispatcher、生命周期、幂等和恢复策略均已落地后，生产者才可采用这种写法。

```ts
await transactionRunner.execute(async (transaction) => {
  await updateOrganization(transaction, change)
  await outbox.append(transaction, {
    tenantId: context.tenantId,
    type: 'organization.renamed',
    version: 1,
    aggregateType: 'organization',
    aggregateId: organizationId,
    occurredAt: clock.now(),
    payload: { organizationId, name },
  })
})
```

不要在事务提交前调用 dispatcher，也不要让事件消费者依赖生产者内部表。

Appender 的第一个参数使用 QueryExecutorProvider，接受 Kysely/Transaction，并复用其 executor；各模块无需合并彼此数据库类型或使用不安全强制类型转换。它不会另开事务，事务边界仍由调用用例拥有。

## 运维

当前没有 worker 心跳、投递吞吐或失败率可监控。数据库中若有启用前遗留行，必须先按事件类型、版本和预期消费者分类，不能通过 Noop Dispatcher 或手工修改 `published_at` 假装完成交付。

首次启用时必须同时提供：

- 具名消费者和版本化契约；
- 具体 dispatcher 与未知事件处理；
- worker 的启动、停止领取、有界 drain 和资源释放；
- 消费者幂等、毒事件恢复和人工重放方案；
- 未发布数量、最老事件年龄、attempts、失败率与 worker 心跳指标；
- 覆盖提交、重复交付、竞争领取、失败重试和进程重启的真实 PostgreSQL 测试。

启用后的积压应由 worker 在修复根因后正常重试；手工改 `published_at` 会掩盖数据未同步问题。
