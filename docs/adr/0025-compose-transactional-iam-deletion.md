# ADR 0025: Compose Transactional IAM Deletion

- Status: Accepted
- Date: 2026-10-15

## Context

用户永久删除会影响凭据、会话和 Organization 成员引用；角色永久删除会影响 Navigation 授权。Organization、Navigation 已依赖 IAM，IAM 反向导入它们会形成循环。当前没有已启用的 Outbox 交付运行时，不能假设删除事件会被消费。

## Decision

- 日常退出使用用户禁用或角色停用。用户永久删除必须已禁用、不是当前账号，且不存在 Organization 组织/岗位关系；历史审计保留。系统角色与已分配角色禁止删除。
- IAM 定义消费方端口 `UserDeletionReferences`、`RoleDeletionCleanup`，Organization 与 Navigation 各自实现。Edition Builder 只为启用模块生成组合根注入，IAM 不反向依赖这些模块。
- Application 决定事务边界。Infrastructure 通过 `createTransactionConnection` 将同一 QueryExecutor 绑定为模块自有类型的 QueryCreator；公开端口不暴露业务表行，不转移连接或事务生命周期。所有参与者只查询自己拥有的表。
- 用户删除使用 `FOR UPDATE` 锁定 IAM 用户；Organization 成员/岗位写事务通过 IAM Public API 先对同一用户加 `FOR KEY SHARE`。角色删除锁定 IAM 角色；用户角色分配先锁定有效角色，Navigation 授权通过 IAM Public API 先对角色加 `FOR SHARE`，再锁导航根。删除与引用写入必须复查锁定后的实际状态，防止悬空引用和新增授权残留。
- 同租户 IAM 管理写操作通过事务级 advisory lock 串行，避免并发禁用/移除角色分配使现有最后管理员检查同时通过。锁键包含 tenantId；各租户互不阻塞。
- 用户删除、全会话撤销、角色导航授权清理和各自审计共用数据库事务；任一步失败全部回滚。无新增事件、无跨 Schema SQL、无全局软删除字段。
- UI 的删除条件检查只改善交互。DELETE 请求在服务端重新授权和校验，不信任预检快照。

## Consequences

无新增表或 Migration。扩展新的身份引用模块时，必须显式装配其删除门禁，并使引用写入遵守 IAM Public API 锁定契约。永久删除的历史操作者 UUID 保留，删除审计保存最小用户名/显示名快照；后续若有必须保持可解析身份的业务引用，应阻止删除而使用禁用。
