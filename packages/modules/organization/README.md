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

## HTTP API

前缀：`/api/v1/organization`。所有路由要求已登录会话；写操作要求 CSRF。

### 组织单元

| 方法   | 路径              | 权限                  | 说明                                       |
| ------ | ----------------- | --------------------- | ------------------------------------------ |
| GET    | `/org-units`      | `organization.view`   | 返回扁平单元列表，客户端按 `parentId` 组树 |
| POST   | `/org-units`      | `organization.manage` | 创建组织（`parentId` 可为 null 表示根）    |
| PATCH  | `/org-units/{id}` | `organization.manage` | 更新字段；可改 `parentId` 移动             |
| DELETE | `/org-units/{id}` | `organization.manage` | 仅空叶子可删                               |

删除门禁：无子节点、无 `user_org` 成员、无 `position`。否则返回 409，应改为禁用。

移动规则：目标 parent 必须同租户存在；不能移到自身或自身后代（服务端 recursive CTE + 显式 self 检查）。

稳定错误码：`ORGANIZATION_UNIT_NOT_FOUND`、`ORGANIZATION_PARENT_NOT_FOUND`、`ORGANIZATION_CODE_CONFLICT`、`ORGANIZATION_MOVE_CYCLE`、`ORGANIZATION_HAS_CHILDREN`、`ORGANIZATION_HAS_MEMBERS`、`ORGANIZATION_HAS_POSITIONS`。

### 岗位

| 方法   | 路径                                             | 权限                  | 说明                         |
| ------ | ------------------------------------------------ | --------------------- | ---------------------------- |
| GET    | `/org-units/{id}/positions`                      | `organization.view`   | 列出该组织下岗位             |
| POST   | `/org-units/{id}/positions`                      | `organization.manage` | 创建岗位                     |
| PATCH  | `/org-units/{id}/positions/{positionId}`         | `organization.manage` | 更新岗位                     |
| DELETE | `/org-units/{id}/positions/{positionId}`         | `organization.manage` | 无用户占用时可删，否则停用   |

岗位编码在 `tenant + org_unit` 内唯一。删除前检查 `user_position`。

稳定错误码：`ORGANIZATION_POSITION_NOT_FOUND`、`ORGANIZATION_POSITION_CODE_CONFLICT`、`ORGANIZATION_POSITION_HAS_MEMBERS`。

## Public API

`@jingwei/module-organization/server/public`：

### `OrganizationSnapshot`

只暴露 `id`、`name`、`parentId`，不把内部行、状态和 Kysely 类型泄露给调用方。

### `OrganizationQuery.descendantsOf(tenantId, organizationIds)`

返回给定组织集合及后代 ID（**包含根节点输入**），用 PostgreSQL recursive CTE 实现，用于 IAM 的 `ORGANIZATION_AND_DESCENDANTS` 数据范围展开。

调用规则：

- tenantId 必须来自可信应用上下文；
- 空输入返回空集合；
- 输出去重且顺序不应成为业务契约；
- 发现跨租户或循环脏数据时安全失败；
- 调用方不直接读取 Organization 表。

工厂：`createOrganizationQuery(database)`、`createOrganizationManagement(database, registry)`、`createOrganizationSnapshot(database)`。

## Web

`OrganizationUnits`：左树 + 右详情（基本信息 / 岗位 Tab）。支持组织搜索、展开折叠、新建/编辑/移动/启停与空叶子删除；选中组织后可维护岗位列表。写按钮仅为 UX；安全边界始终在服务端权限校验。

## 当前实现状态

组织树 P0：查询、创建、更新（含移动防环）、空叶子删除、IAM 权限、审计、OpenAPI client、Web 管理页与应用层单测。

岗位 P0：按组织列出、创建、更新、启停、无占用删除；应用层单测覆盖唯一码与删除门禁。

尚未实现：用户组织/岗位归属与主归属约束、outbox 集成事件、组织树 PostgreSQL 集成测试、数据范围执行器对接。

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
