# `@jingwei/testing`

跨模块共享的轻量测试 fixture。目前提供一致的应用上下文与固定时钟，避免测试自行伪造无效 ID 或依赖真实时间。

## 公共 API

### `createTestContext(overrides?)`

生成有效 UUIDv7 requestId、tenantId、userId，并允许按字段覆盖：

```ts
const context = createTestContext({ tenantId: knownTenantId })
```

覆盖值仍由 TypeScript 品牌类型约束。外部字符串 fixture 应先经过 `to*Id` 解析，不要使用类型断言。

### `fixedClock(value?)`

创建每次 `now()` 都返回新 `Date` 实例的固定时钟：

```ts
const clock = fixedClock('2026-09-01T08:00:00.000Z')
```

返回新实例可防止被测代码修改 Date 对象后污染后续断言。默认时间是仓库初始化基准，只适合不关心具体日期的测试。

## 适用范围

本包适合稳定、通用且无业务语义的 fixture。以下内容不应加入：

- IAM 默认管理员或密码；
- Organization 组织树样例；
- 模块数据库建表逻辑；
- 大量“万能对象 builder”；
- 只服务一个测试文件的 helper。

业务 fixture 留在所属模块测试目录，能更准确地随领域演进。

## 测试约定

- 测试用例不要依赖执行顺序；
- 每个测试创建自己的上下文；
- 过期、重试和排序测试使用显式时钟；
- 需要推进时间时，应创建可控 Clock fake，而不是修改系统时间；
- 本包不替代真实 PostgreSQL 和 HTTP 集成测试。

全仓库策略见 [测试与质量手册](../../../docs/testing-quality.md)。
