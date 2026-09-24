# Database Design

V1 使用一个 PostgreSQL 18 Database 与多个 module-owned schema：`platform.*`、`control_plane.*`、`iam.*`、`branding.*`、`organization.*`、`navigation.*`、`dictionary.*`。`platform.*` 中的表由明确的平台包分别拥有，例如 Tenancy、Auth、Audit 和 Outbox；`control_plane.*` 只保存全局平台 operator 及其独立会话；未来业务模块继续使用自己的 schema。

## Ownership 与关联

- 每张表有且只有一个 Owner Module；只有 Owner 能直接查询/变更。
- 模块内允许 Foreign Key；跨模块不建立 Foreign Key、不执行 SQL/DDL。
- 跨模块引用保存 UUID，通过 Public API、Application rule、Integration Event 保证一致性。

## Tenant 与数据类型

- 普通业务 Root Data 使用 `tenant_id uuid not null`，常见唯一约束/索引从 `(tenant_id, ...)` 开始。
- 核心 ID 使用 UUID v7；业务编号不是主键，由并发安全 NumberGenerator 生成。
- 事件时间用 `timestamptz`/UTC；业务日期用 `date`。
- 金额通常 `numeric(19,4)`，价格/数量可用 `numeric(19,6)`；金额同时明确 currency，API 使用 decimal string。
- 重要 Root Entity 使用 `version bigint` 乐观锁。
- 普通 Master Data 可按业务支持 soft delete；业务单据以明确状态与作废/冲销行为保留历史。

## Platform schema

只保存跨模块基础设施：tenant、auth_session、auth_refresh_token、outbox、audit_log、number_sequence。tenant 由 `@jingwei/tenancy` 拥有并使用 PROVISIONING/ACTIVE/SUSPENDED/DISABLED 生命周期；auth_session 保存当前短期 access hash 与 token family 生命周期；auth_refresh_token 保存 refresh 代际 hash 和消费时间用于轮换与复用检测。未知归属的数据不得丢入 platform。

Audit Log append-only，且在统一 serializer 处过滤 password、hash、token、secret、API key 等敏感信息。Outbox 表预留 event/aggregate identity、payload、occurred/published/attempt/retry/error 字段；当前没有生产者或 worker，启用规则见 ADR 0014。

## Control Plane schema

`control_plane.operator`、`operator_credential`、`operator_session` 和 `operator_refresh_token` 由 `@jingwei/control-plane` 独占。operator 是全局运维身份，不带 tenant_id，也不外键关联 IAM user；平台会话的 Cookie 与 token family 不可用于租户接口。平台审计仍写入 `platform.audit_log`，全局操作的 tenant_id 为 null，租户生命周期操作可记录目标 tenant_id。

## Migration

Navigation 使用一张版本化 navigation_node 表，统一保存 DIRECTORY/GROUP/MENU/PAGE/EXTERNAL_LINK；不额外建 Route 表。path/layout 是正常列，params/query 是 JSONB 字面量配置。navigation 根保存当前发布指针；version 保存 revision、edit_revision、auth_entry_code/home_code。复合外键限制 parent/version/根指针在同一租户范围，数据库 trigger 保护发布快照不可变。

navigation.role_navigation 保存 tenant_id、IAM role_id 和稳定 navigation_code。它不外键引用 IAM 或某个版本节点；应用通过 IAM Public API 验证角色，回滚配置不会改动 grants。详细字段见 [Navigation 模块](../packages/modules/navigation/README.md)。

Dictionary 使用 `dictionary_category -> dictionary_type -> dictionary_item` 三级结构。Category 只是租户管理目录；Type 与 Item code 是稳定业务身份。复合外键保证 Category/Type/Item 属于同一 tenant，不使用级联删除清空历史解析数据。Type revision 在其自身或条目变化时递增。详见 [Dictionary 模块](../packages/modules/dictionary/README.md)。

Branding 使用 `brand_profile -> brand_version` 发布指针和不可变版本快照；`brand_asset` 保存经用途校验的
小型 PNG 或横向 Logo SVG。版本显式保存横向品牌显示方式与 Logo 颜色策略，不再从素材空值推断。
版本使用普通受约束列保存稳定主题选择与工作区默认布局；仅自定义 50–950 色阶和版本化语义覆盖使用
JSONB，并在 Zod、Repository 与发布用例中按固定白名单验证，绝不保存任意 CSS。
恢复平台默认只清空发布指针，历史版本和素材均保留。用户覆盖是 Web 端按租户和用户保存的稀疏偏好，
不属于 Branding 数据表。详见 [Branding 模块](../packages/modules/branding/README.md)。

Migration 位于 Owner package，文件名全局唯一且发布后不可修改。Edition Builder 将启用模块的 migration 作为静态 build artifact；生产运行器不扫描源码目录。停用模块只停止加载代码/API/menu/permission/new migration，历史 schema 默认保留，删除数据必须走独立 decommission 流程。
