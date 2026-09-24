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

跨模块 user ID 不建立到 IAM 表的数据库外键。应用层通过 IAM 公共契约保证主体存在；IAM 用户删除/禁用后的最终一致性处理尚未设计，不能假设当前存在事件消费链路。

`20260916090001_organization_membership_primary.ts` 使用部分唯一索引强制每个租户用户最多一个主组织、最多一个主岗位；写用例在同一事务内先降级旧主项，再设置新主项。

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

| 方法   | 路径                                     | 权限                  | 说明                       |
| ------ | ---------------------------------------- | --------------------- | -------------------------- |
| GET    | `/org-units/{id}/positions`              | `organization.view`   | 列出该组织下岗位           |
| POST   | `/org-units/{id}/positions`              | `organization.manage` | 创建岗位                   |
| PATCH  | `/org-units/{id}/positions/{positionId}` | `organization.manage` | 更新岗位                   |
| DELETE | `/org-units/{id}/positions/{positionId}` | `organization.manage` | 无用户占用时可删，否则停用 |

岗位编码在 `tenant + org_unit` 内唯一。删除前检查 `user_position`。

稳定错误码：`ORGANIZATION_POSITION_NOT_FOUND`、`ORGANIZATION_POSITION_CODE_CONFLICT`、`ORGANIZATION_POSITION_HAS_MEMBERS`。

### 成员归属

| 方法   | 路径                                         | 权限                  | 说明                                    |
| ------ | -------------------------------------------- | --------------------- | --------------------------------------- |
| GET    | `/member-candidates`                         | `organization.manage` | ACTIVE 候选用户（不要求 iam.user.view） |
| GET    | `/org-units/{id}/members`                    | `organization.view`   | 成员 + 安全用户投影 + 本组织岗位        |
| POST   | `/org-units/{id}/members`                    | `organization.manage` | 加入组织                                |
| PATCH  | `/org-units/{id}/members/{userId}`           | `organization.manage` | 改主归属 / 加入日期                     |
| DELETE | `/org-units/{id}/members/{userId}`           | `organization.manage` | 移出组织，并解除本组织岗位              |
| PUT    | `/org-units/{id}/members/{userId}/positions` | `organization.manage` | 整组替换本组织岗位                      |

规则：

- 用户必须在 IAM 同租户存在（`IamUserDirectory`）；
- 同一用户可属于多个组织，全局最多一个主组织；
- 禁止向 DISABLED 组织新增成员；
- 岗位分配仅允许该组织下 ENABLED 岗位；同一用户全局最多一个主岗位；
- 写事务同步写 Audit；当前没有成员变更消费者，因此不写 speculative Outbox。

稳定错误码：`ORGANIZATION_USER_NOT_FOUND`、`ORGANIZATION_MEMBER_NOT_FOUND`、`ORGANIZATION_MEMBER_EXISTS`、`ORGANIZATION_UNIT_DISABLED`、`ORGANIZATION_POSITION_NOT_IN_UNIT`、`ORGANIZATION_MULTIPLE_PRIMARY_POSITIONS`、`ORGANIZATION_POSITION_ASSIGNMENT_EXISTS`。

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

### `OrganizationMembershipQuery`

- `orgUnitIdsOf(tenantId, userId)`：用户所属组织 ID；
- `primaryOrgUnitIdOf(tenantId, userId)`：用户主组织 ID 或 null。

用于后续 Data Scope 执行器；本模块只提供事实，不负责授权决策。

工厂：`createOrganizationQuery(database)`、`createOrganizationManagement(database, registry)`、`createOrganizationSnapshot(database)`、`createOrganizationMembershipQuery(database)`。

## Web

`OrganizationUnits`：左树 + 右详情（基本信息 / 岗位 / 成员 Tab）。支持组织搜索、展开折叠、新建/编辑/移动/启停与空叶子删除；选中组织后可维护岗位列表与成员归属（加入、主组织、本组织岗位）。写按钮仅为 UX；安全边界始终在服务端权限校验。
页面沿用基础管理工作区的等高列表/详情头部、可拖拽分割线和展开式搜索；新建根组织使用列表头部图标入口，新建下级组织保留在对应树节点。窄屏在列表与详情之间切换。

## 当前实现状态

组织树 P0：查询、创建、更新（含移动防环）、空叶子删除、IAM 权限、审计、OpenAPI client、Web 管理页与应用层单测。

岗位 P0：按组织列出、创建、更新、启停、无占用删除；应用层单测覆盖唯一码与删除门禁。

成员归属 P0：加入/更新/移出、主组织唯一（partial unique index）、本组织岗位整组替换、主岗位唯一、IAM 用户目录水合、Audit、Web 成员面板与应用层单测。

尚未实现：组织树/成员 PostgreSQL 集成测试、IAM 用户删除后的 membership 消费清理。

数据范围：`organization.view` 明确允许 `ALL / ORGANIZATION / ORGANIZATION_AND_DESCENDANTS / CUSTOM`，不允许 `SELF`。树、岗位列表、成员列表经 `AuthorizationEvaluator.requireScopedPermission` 校验；成功结果必有显式 scope，不存在 `null = ALL`。受限组织树由 Repository 使用 recursive CTE 只读取 scope 内节点及导航所需祖先，岗位/成员详情则要求目标组织严格落在 scope 内。Organization 实现 IAM 消费方定义的 `OrganizationalScopeFacts`；CUSTOM 组织 ID 在授权保存和求值时都按当前租户及启用状态校验，失效或跨租户 ID 会令授权 fail closed。`GET /scope-options` 只供具备 `iam.role.manage` 的集中式角色管理员读取当前租户全部有效组织，不复用 `organization.view` 数据范围。Edition 生成代码显式注入服务端事实适配器和 Web 选择目录，不使用全局注册器。`organization.manage` 仍为无数据范围功能权限，并通过独立的 `requireUnscopedPermission` 入口检查。

## Integration Event 边界

当前没有 Organization 事件消费者，不发布 `organization.membership.changed` 或其他预留事件。主归属/主岗位降级信息保存在同事务 Audit 中。第一个真实异步消费者出现时，再同时定义事件契约、幂等语义和交付运行时（ADR 0014）。

## 修改检查表

- 所有 SQL 显式 tenant 范围；
- parent 属于同一租户且不会形成环；
- 主组织/岗位约束可抵抗并发；
- 跨模块只使用 IAM user ID/public contract；
- 数据范围查询有真实 PostgreSQL 集成测试；
- 删除/停用对岗位、成员及未来下游同步的语义已定义；
- 更新本 README 和数据库设计。
