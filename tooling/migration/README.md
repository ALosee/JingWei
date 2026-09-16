# `@jingwei/migration`

Jingwei 的 Edition-aware PostgreSQL 迁移 CLI。它消费 Edition Builder 生成的迁移集合，并使用 Kysely Migrator 查询或升级数据库。

## 入口与实现

脚本路径和 pnpm 命令保持稳定，`src/cli.ts`、`seed-dev.ts`、`seed-navigation.ts`、`smoke-auth.ts`、`test-navigation-real.ts` 都只调用对应 `src/commands/` 的具名函数。环境输入、连接生命周期、运维流程及输出属于 command，不属于可执行入口；导入 command 文件不会自动迁移、连库或更新开发数据。

这类受控运维脚本不是普通业务请求，不得为了复用种子 SQL 让模块用例绕过公开契约。无需为缩短文件把一次完整种子拆成零散 helper；只有独立规则或资源所有权才继续拆分。统一原则见 [代码职责约束](../../docs/code-structure.md)。

## 命令

```bash
pnpm migration:status
pnpm migration:up
```

### `status`

按迁移顺序输出 `PENDING` 或 `EXECUTED`，不修改业务 Schema。

### `up`

执行到生成集合的最新迁移，逐条输出 Kysely 状态；任意错误使进程非零退出。CLI 在成功或失败后都会关闭数据库连接池。

### `seed:dev`

迁移完成后可创建最小、可登录的本地租户与用户：

```bash
DEV_ADMIN_PASSWORD='<至少 12 个字符>' pnpm seed:dev
```

默认创建或更新租户 `default` 和用户 `admin`。可通过 `DEV_TENANT_CODE`、`DEV_TENANT_NAME`、`DEV_ADMIN_LOGIN`、`DEV_ADMIN_DISPLAY_NAME` 覆盖非敏感字段。命令可重复执行，会更新开发用户密码；在 `NODE_ENV=production` 下强制拒绝运行。密码只从环境读取，不写入迁移、日志或仓库。

启动真实 Server 后，可执行认证烟雾测试：

```bash
TEST_ADMIN_PASSWORD='<seed 时使用的密码>' pnpm test:auth:real
```

它会依次验证错误密码被拒绝、真实登录、Access/Refresh/CSRF Cookie、会话恢复、Refresh 轮换、旧 Access 失效、已认证 Navigation、带 Origin/CSRF 的退出，以及已撤销 Token Family 无法再次认证。可通过 `TEST_BASE_URL` 指向非默认端口。

### `seed:navigation`

迁移和 seed:dev 之后执行 `pnpm seed:navigation`。它要求目标租户和用户已存在且活跃，默认为 default/admin，可用 DEV_TENANT_CODE、DEV_ADMIN_LOGIN 覆盖。

- 创建 development-admin 角色并分配给开发用户；显式投影/授予当前 Edition 的功能权限，不依赖 is_super。
- 仅在没有已发布配置时创建首个草稿并发布；不会覆盖已有导航。
- 给开发角色授予当前发布版本所有 PERMISSION 节点 code，移除不在当前版本的残留 code；不是普通生产授权同步器。
- 不读取或修改密码；角色、版本与授权操作记录审计。
- 拒绝 NODE_ENV=production。正常应用启动不自动运行该工具。

### `seed:dictionary`

在 seed:dev 之后执行 `pnpm seed:dictionary`。幂等写入开发租户样例字典：分类 `common`，类型 `common.source` / `common.priority` / `common.tag` 及其启用条目。不会覆盖已有类型或条目；`NODE_ENV=production` 下拒绝运行。

### 显式使用 .env.test

一次性 CLI 不自动读取 .env 文件。若数据库配置位于仓库根目录 .env.test，使用 Node 的 env-file 参数（从仓库根运行）：

```bash
pnpm edition:generate development
node --env-file=.env.test --import tsx tooling/migration/src/cli.ts status
node --env-file=.env.test --import tsx tooling/migration/src/cli.ts up
# 已有开发用户无需重复 seed:dev，重复执行会更新其密码。
node --env-file=.env.test --import tsx tooling/migration/src/seed-navigation.ts
pnpm dev:test
```

新库需先通过环境变量提供 DEV_ADMIN_PASSWORD 并运行 seed-dev.ts，再运行 seed-navigation.ts。不要把密码写进迁移或文档。

### `test:navigation:real`

```bash
node --env-file=.env.test --import tsx tooling/migration/src/test-navigation-real.ts
```

工具使用配置中的 PostgreSQL 实例创建唯一的 jingwei_navigation_test_* 临时数据库，运行所有迁移和真实 API/事务测试，最后删除这一个临时数据库，不清空应用数据库。连接账号必须具有 CREATEDB 权限。测试覆盖密码失败锁定、Cookie Token 轮换、code RBAC、跨租户访问、CSRF、并发写入/发布、回滚、不可变快照和 Audit 故障回滚。

普通 pnpm test 不连接数据库，会跳过此集成 suite。单独运行集成测试必须使用 TEST_DATABASE_URL 且数据库名通过临时前缀保护；推荐使用上述包装工具以确保 finally 清理。

### Navigation 升级注意事项

20260902000100_navigation_configuration 将旧 ROUTE 按 visible 转为 MENU/PAGE，title/external_url 改名为 name/href，并新增 code、layout、params/query、grant 和发布保护。旧 routeKey 用作初始 code，无 routeKey 的节点生成 node.<UUID>。升级前备份；不提供自动 down，恢复使用已验证备份或向前修复。新 API schemaVersion 为 2，需要前后端一起部署。

## Edition 一致性

CLI 不自行选择模块，而是导入 `apps/server/src/generated/migrations.ts`。因此执行前必须先生成目标 Edition：

```bash
pnpm edition:generate full
pnpm migration:status
pnpm migration:up
```

构建、迁移和部署若使用不同 Edition，可能出现运行时代码缺表或数据库安装了不应交付的模块结构。

## 迁移集合

当前始终包含 platform database、auth、audit、outbox 迁移；其中 outbox 只预留平台表结构，不代表 worker 已启用。然后按解析顺序加入选中业务模块迁移。迁移名必须全局唯一，否则 Kysely 迁移记录会冲突。

## 安全约定

- 命令使用 `@jingwei/config` 解析 `DATABASE_URL`；
- 执行前明确确认目标环境，避免默认本地值掩盖配置错误；
- 生产先备份并演练恢复；
- 已执行迁移不原地修改；
- 大表变更设计锁、回填和兼容发布；
- 当前 CLI 不提供 down 命令，恢复优先使用向前迁移/备份策略；
- 日志不输出数据库连接串。

## 新增迁移

1. 在所有者包的 `migrations/` 新增唯一有序文件；
2. 加入该包 `migrations/index.ts`；
3. 生成目标 Edition；
4. 在空库执行；
5. 从旧版结构执行升级；
6. 检查 `status`；
7. 验证应用生产构建。

详细发布策略见 [运维手册](../../docs/operations.md)。
