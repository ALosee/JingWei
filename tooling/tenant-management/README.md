# Tenant Management CLI

这个命令是平台管理页面不可用时的受限灾备入口。创建和重试复用 Control Plane 的同一个 `ProvisionTenant` 用例，生命周期操作复用 Tenancy 用例；它不复制 IAM/Navigation 编排，也不直接跨模块写表。

所有命令都要求 `TENANT_OPERATOR_ID`，作为平台审计中的 CLI 操作者标识。创建和重试还要求通过环境或部署 Secret 注入 `TENANT_ADMIN_PASSWORD`；密码不得作为命令行参数，也不会进入日志或审计。

```bash
TENANT_OPERATOR_ID='ops@example.com' \
TENANT_ADMIN_PASSWORD='<至少 12 个字符>' \
pnpm tenant:manage create \
  --code acme \
  --name 'Acme 公司' \
  --admin-login admin \
  --admin-name 'Acme 管理员' \
  --admin-email admin@example.com
```

初始化失败的租户保持 `PROVISIONING`，修复原因后使用相同管理员参数重试：

```bash
TENANT_OPERATOR_ID='ops@example.com' \
TENANT_ADMIN_PASSWORD='<至少 12 个字符>' \
pnpm tenant:manage retry \
  --code acme \
  --admin-login admin \
  --admin-name 'Acme 管理员'
```

生命周期命令：

```bash
TENANT_OPERATOR_ID='ops@example.com' pnpm tenant:manage list
TENANT_OPERATOR_ID='ops@example.com' pnpm tenant:manage suspend --code acme
TENANT_OPERATOR_ID='ops@example.com' pnpm tenant:manage resume --code acme
TENANT_OPERATOR_ID='ops@example.com' pnpm tenant:manage disable --code acme
```

`disable` 只接受 `SUSPENDED` 或 `PROVISIONING`，不删除任何模块数据。暂停和停用会撤销该租户的所有会话，Access/Refresh 同时通过活动租户门禁 fail closed。
