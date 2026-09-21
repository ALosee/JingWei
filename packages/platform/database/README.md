# `@jingwei/database`

PostgreSQL/Kysely 的平台运行时、事务和迁移基础。它统一管理连接池；租户目录与生命周期由 `@jingwei/tenancy` 拥有。

## 导出

| API                       | 作用                                             |
| ------------------------- | ------------------------------------------------ |
| `DatabaseRuntime`         | 持有一个进程级 `pg.Pool`，创建类型化 Kysely 视图 |
| `TransactionRunner<T>`    | 以统一接口执行 Kysely 事务                       |
| `createTransactionRunner` | 从 Kysely 视图创建事务执行器                     |
| `MigrationMap`            | 静态迁移名到 Kysely Migration 的映射             |
| `StaticMigrationProvider` | 向 Kysely Migrator 提供不可变迁移集合            |
| `./migrations`            | 平台基础表迁移入口                               |

## `DatabaseRuntime`

```ts
const runtime = new DatabaseRuntime(config.databaseUrl)
const iamDb = runtime.view<IamDatabase>()

try {
  // start server
} finally {
  await runtime.dispose()
}
```

多个 `view<TDatabase>()` 共享同一个连接池，只改变编译期数据库类型。模块不能为每个仓储创建新 pool，也不能把 `DatabaseRuntime` 作为请求级对象反复创建。

## 事务

`TransactionRunner.execute` 保证回调成功后提交、抛错后回滚。跨多次写入的业务用例应接收 transaction，并让业务数据与审计共用它；存在已启用真实消费者时，相关 outbox append 也必须复用该 transaction。

Kysely 的类型参数只描述可见表，不提供运行时租户隔离。每个模块仍必须在 SQL 中包含 `tenant_id` 条件，并用集成测试证明。

## 迁移

平台基础迁移通过 `@jingwei/database/migrations` 导出。业务模块拥有自己的迁移入口，由 Edition Builder 选择后交给迁移工具。

- 迁移名全局唯一且按时间排序；
- 已执行迁移不原地修改；
- 运行时请求不执行 DDL；
- 构建、迁移和部署必须使用同一 Edition。

## 资源和失败

- 启动连接失败应阻止服务就绪；
- `dispose` 只在进程停止时调用一次；
- 不吞掉事务异常；
- 不在错误响应中暴露连接串、SQL 和驱动堆栈；
- 慢查询、池耗尽和连接失败应进入结构化日志/指标。

数据库整体设计见 [数据库设计](../../../docs/database-design.md)。
