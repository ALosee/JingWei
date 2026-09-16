# Dictionary 模块

包：`@jingwei/module-dictionary`；模块 ID：`dictionary`；类别：`foundation`；必需依赖：`iam`。

Dictionary 提供租户级、可管理的低频枚举数据。它适合“可配置但仍有稳定 code 的选项”，不用于任意配置、翻译资源或高频业务实体。

管理目录使用固定三级结构：`Category -> Type -> Item`。Category 只负责展示分组；Type code 是跨模块稳定身份；Item code 是业务数据应存储的稳定取值。

## 职责与非职责

Dictionary 负责：

- 纯展示用的租户字典分类；
- 租户字典类型；
- 字典条目的 code、label、排序和启用状态；
- 向其他模块提供只读条目快照查询；
- 字典管理页面的能力与权限声明。

Dictionary 不负责：

- 系统环境配置或 Secret；
- 前端 i18n 翻译文件；
- 组织、角色、产品等拥有独立生命周期的实体；
- 把所有枚举都改成数据库可配置；
- 让其他模块直接引用 dictionary item 的内部主键。

## 何时使用字典

适合：来源类型、业务标签、可由租户管理员维护的有限选项。

不适合：

- 会驱动核心状态机的固定状态；
- 需要复杂关系、权限或大量字段的数据；
- 高频计数或流水；
- 只在单个模块内部使用且稳定的 TypeScript union。

核心领域状态优先保留为代码中的显式类型，防止管理员配置出领域无法处理的状态。

## Manifest

- capability：`dictionary.core`；
- permissions：`dictionary.view`、`dictionary.manage`；
- route：`dictionary.entries` → `DictionaryEntries`，需要 view；
- 依赖 IAM 以识别管理主体和执行授权/审计。

## 数据所有权

| 表                               | 作用       | 关键约束                                      |
| -------------------------------- | ---------- | --------------------------------------------- |
| `dictionary.dictionary_category` | 展示分类   | tenant + code 唯一；非空时不允许删除          |
| `dictionary.dictionary_type`     | 字典类型   | tenant + code 唯一；必须属于同租户分类        |
| `dictionary.dictionary_item`     | 类型下条目 | tenant + type + code 唯一；必须属于同租户类型 |

分类没有启停状态，不能改变字典的业务可用性。类型可在分类之间移动，但类型 code 在租户内仍全局唯一且创建后不可修改。条目 code 同样不可修改；业务模块不引用条目 UUID。

每个类型是一个轻量聚合。`revision` 在类型或其条目变化时递增，所有修改提交 `expectedRevision`，用于阻止多管理员互相覆盖。类型和条目不提供物理删除 API，录错 code 时创建正确项并停用旧项。

## Public API

`@jingwei/module-dictionary/server/public` 导出：

### `DictionaryQuery.getSnapshot(tenantId, dictionaryCode)`

按稳定 Type code 查询某租户字典快照。返回类型 code、name、enabled、revision 以及全部条目的：

- `code`：稳定条目标识；
- `label`：当前展示文字；
- `enabled`：是否可用于新选择。

条目按 `sort_order`、code 稳定排序。`enabled=false` 仅表示不可再用于新选择；历史数据仍可以解析当前 label。业务单据需要保留当时文字时，由消费模块保存 label 快照。

### `DictionaryQuery.resolveItems(tenantId, dictionaryCode, itemCodes)`

为已存储的 code 批量解析当前条目快照，包含已停用条目。未知 code 不会伪造 label。

Category 完全不出现在 Public API 中；移动类型分类不影响业务消费者。

## 如何消费（表单与业务模块）

管理接口不是给任意业务用户查选项用的。推荐分层：

1. **业务模块服务端**用 `createDictionaryQuery(database).getSnapshot/resolveItems` 读字典，再经自己的权限边界返回允许的选项；单据只存稳定 `item.code`。
2. **管理端或具备 `dictionary.view` 的表单**可直接用本模块 Web 原语：

```ts
import { DictionarySelect, useDictionaryOptions } from '@jingwei/module-dictionary/web/forms'

// 一行下拉：v-model 存 code，label 仅展示
<DictionarySelect v-model="form.source" dictionary-code="common.source" />

// 或自行组装
const { options, loading, error } = useDictionaryOptions('common.priority')
```

`GET /api/v1/dictionary/types/by-code/{code}` 按稳定类型 code 返回详情（需 `dictionary.view`）。开发环境可运行 `pnpm seed:dictionary` 写入 `common.source` / `common.priority` / `common.tag` 样例（幂等，禁止在生产执行）。

## HTTP 与管理页

管理 HTTP 接口使用 `/api/v1/dictionary`，提供目录、类型详情、分类创建/更新/空分类删除、类型创建/更新和条目创建/更新。读取要求 `dictionary.view`，修改要求 `dictionary.manage` 并执行 Origin/CSRF 校验。

它们是管理接口，不是任意业务用户可查询所有字典的通用端点。消费模块应在服务端使用 Public API，再通过自己的权限边界返回允许的选项。

管理页左侧使用可展开、可折叠的 Tree 按分类展示类型，分类和类型都是可选择的目录节点。右侧维护当前分类及其类型，或当前类型及其条目；分类、类型、条目的新建与编辑统一在右侧工作区完成，不使用弹窗，只有删除保留确认提示。搜索同时匹配分类、类型名称和 code，并自动展开匹配分支。

## 事务、审计与事件

每个修改在同一 PostgreSQL transaction 中锁定聚合、比较 revision、写业务数据和 Audit。类型/条目变化同时追加 `dictionary.definition.changed` v1 Outbox Event，payload 只包含 `dictionaryCode` 和 `revision`。分类只是展示目录，其变化写审计但不发布字典定义事件。

## 缓存与一致性

当前不做跨请求缓存，PostgreSQL 是唯一正确来源。未来如经证明需要缓存，key 必须包含 tenantId 和 dictionaryCode，并使用 revision/变更事件完成多实例可靠失效。

## 当前实现状态

已实现三级目录、租户约束、revision 并发控制、PostgreSQL 查询/事务、管理 HTTP/OpenAPI client、Public Query、Audit/Outbox 和 Web 管理页。当前不提供跨请求缓存、通用业务用户 HTTP lookup、导入导出、多语言 label、层级条目或模块自动声明内置字典。

## 修改检查表

- 查询和唯一性都包含 tenant；
- Category 只影响展示，不影响 Public API 或业务可用性；
- code 发布后保持稳定；
- label 变化不破坏业务判断；
- 禁用与删除的历史数据语义明确；
- 管理动作检查 `dictionary.manage` 并写审计；
- 修改使用 expectedRevision，业务写入、审计和 Outbox 共享事务；
- 若引入缓存，必须有可靠的租户隔离和多实例失效机制；
- 其他模块只依赖 public query/事件，不读表；
- 新增 HTTP 接口同步更新系统 API 文档。
