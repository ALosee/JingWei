# `@jingwei/tenancy`

平台租户注册表、生命周期和活动状态边界。它拥有 `platform.tenant` 的运行时语义，并为登录、匿名启动和会话安全提供窄查询端口。

## 生命周期

```text
PROVISIONING -> ACTIVE -> SUSPENDED -> ACTIVE
       |            |          |
       +------------+----------+-> DISABLED（仅允许从 PROVISIONING/SUSPENDED 进入）
```

- `PROVISIONING` 不允许登录；初始化步骤可幂等重试。
- `ACTIVE` 是唯一可创建、恢复或刷新会话的状态。
- `SUSPENDED` 可恢复，切换时撤销全部租户会话。
- `DISABLED` 是停用终态，不删除其他模块的历史数据。

租户 code 规范化为小写且创建后不可修改。Edition、Module 和 Capability 是构建期产品选择，不是租户字段。

## 公共端口

- `TenantDirectory.findActiveByCode`：匿名启动和登录解析。
- `TenantDirectory.isActive`：Access/Refresh 请求的 fail-closed 活动检查。
- `ManageTenants`：已通过外部 Operator/CLI 授权的控制面用例；它不接受普通租户 `AuthContext`。
- `createTenantManagement`：在运维组合根中装配 PostgreSQL 实现。

业务模块不得列出全部租户或直接查询 `platform.tenant`。普通租户请求始终从可信 Session 获得 tenantId。
