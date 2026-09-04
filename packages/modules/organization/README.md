# Organization 模块

包：`@jingwei/module-organization`；模块 ID：`organization`；类别：`foundation`；必需依赖：`iam`。

Organization 拥有租户组织树、岗位、用户组织归属和用户岗位分配，为数据范围与其他业务模块提供稳定组织查询。

## 职责与非职责

Organization 负责：

- 组织单元及父子结构；
- 组织内岗位；
- 用户所属组织和主组织；
- 用户岗位和主岗位；
- 组织后代查询的公共端口；
- 组织管理页面的 manifest 契约。

Organization 不负责：

- 用户身份与账号生命周期（IAM）；
- 权限授予和数据范围决策（IAM）；
- HR Employee、Job、Job Family、劳动合同；
- 把组织节点当作租户；
- 维护其他模块的业务归属关系。

## Manifest

- capability：`organization.core`；
- permissions：`organization.view`、`organization.manage`；
- route：`organization.units` → `OrganizationUnits`，PERMISSION 模式，需要 view；
- 依赖 IAM，因为成员引用 IAM user ID，管理动作由 IAM 主体执行。

## 组织类型

共享入口导出：`COMPANY`、`DIVISION`、`DEPARTMENT`、`TEAM`、`OTHER`。类型用于表达组织单元类别，不应用来硬编码层级深度；不同租户可以有不同树结构。

## 数据所有权

| 表                           | 作用                | 关键约束                          |
| ---------------------------- | ------------------- | --------------------------------- |
| `organization.org_unit`      | 邻接表组织树        | tenant + code 唯一；parent 自引用 |
| `organization.position`      | 某组织内岗位        | tenant + org + code 唯一          |
| `organization.user_org`      | IAM user 与组织关系 | tenant/user/org 复合主键          |
| `organization.user_position` | IAM user 与岗位关系 | tenant/user/position 复合主键     |

跨模块 user ID 不建立到 IAM 表的数据库外键。应用层通过 IAM 公共契约保证主体存在，并通过事件处理删除/禁用后的最终一致性。

`is_primary` 的唯一性目前未由迁移中的部分索引强制，后续实现写用例时必须用事务和数据库约束保证每个用户最多一个主组织/主岗位。

## Public API

`@jingwei/module-organization/server/public`：

### `OrganizationSnapshot`

只暴露 `id`、`name`、`parentId`，不把内部行、状态和 Kysely 类型泄露给调用方。

### `OrganizationQuery.descendantsOf(tenantId, organizationIds)`

返回给定组织集合及/或后代 ID（具体是否包含根节点要在实现和测试中固定契约）。预期用 PostgreSQL recursive CTE 实现，用于 IAM 的 `ORGANIZATION_AND_DESCENDANTS` 数据范围展开。

调用规则：

- tenantId 必须来自可信应用上下文；
- 空输入返回空集合；
- 输出去重且顺序不应成为业务契约；
- 发现跨租户或循环脏数据时安全失败；
- 调用方不直接读取 Organization 表。

## 当前实现状态

已定义 manifest、迁移、组织类型、公共查询契约和 Web 页面骨架。Server 路由、PostgreSQL 查询实现、组织/岗位 CRUD、树移动规则、主归属约束和事件尚未实现，当前 `/api/v1/organization` 为空路由集合。

实现树移动时要防止把节点移动到自身后代，并评估大树 recursive CTE、锁与并发修改。

## 建议事件

未来可发布 `organization.created`、`organization.moved`、`organization.disabled`、`organization.membership.changed` 等事实。事件 payload 保持最小，并通过 outbox 与写事务一致。

## 修改检查表

- 所有 SQL 显式 tenant 范围；
- parent 属于同一租户且不会形成环；
- 主组织/岗位约束可抵抗并发；
- 跨模块只使用 IAM user ID/public contract；
- 数据范围查询有真实 PostgreSQL 集成测试；
- 删除/停用对岗位、成员和下游事件的语义已定义；
- 更新本 README 和数据库设计。
