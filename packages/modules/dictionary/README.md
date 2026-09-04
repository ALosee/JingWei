# Dictionary 模块

包：`@jingwei/module-dictionary`；模块 ID：`dictionary`；类别：`foundation`；必需依赖：`iam`。

Dictionary 提供租户级、可管理的低频枚举数据。它适合“可配置但仍有稳定 code 的选项”，不用于任意配置、翻译资源或高频业务实体。

## 职责与非职责

Dictionary 负责：

- 租户字典类型；
- 字典条目的 code、label、value、排序和启用状态；
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

| 表                           | 作用       | 关键约束                          |
| ---------------------------- | ---------- | --------------------------------- |
| `dictionary.dictionary_type` | 字典类型   | tenant + code 唯一                |
| `dictionary.dictionary_item` | 类型下条目 | type + code 唯一，type 删除时级联 |

类型和条目都保留 created/updated actor 与时间。条目 `value` 是业务值，`label` 是展示文字；消费者应以稳定 code/value 判断，不能依赖可修改 label。

## Public API

`@jingwei/module-dictionary/server/public` 导出：

### `DictionaryQuery.findItems(tenantId, dictionaryCode)`

查询某租户、某字典类型的条目快照。快照只包含：

- `code`：稳定条目标识；
- `label`：当前展示文字；
- `enabled`：是否可用于新选择。

建议实现按 `sort_order`、code 稳定排序。`enabled=false` 的历史值可能仍需展示，因此调用方不能简单把禁用解释为数据非法。

接口当前没有暴露 `value`，消费者若确实需要应先澄清 code 与 value 的语义，再以兼容方式扩展快照。

## 缓存与一致性

字典是适合缓存的低频数据，但缓存 key 必须包含 tenantId 和 dictionaryCode。管理修改后可发布事件使消费者失效缓存；在此之前优先保证数据库读取正确，不引入无失效策略的进程内永久缓存。

## 当前实现状态

已定义 manifest、表迁移、公共查询契约、共享快照和 Web 页面骨架。Server 路由、PostgreSQL query、管理 CRUD、缓存与变更事件尚未实现，当前 `/api/v1/dictionary` 为空路由集合，client 只有占位接口。

## 修改检查表

- 查询和唯一性都包含 tenant；
- code 发布后保持稳定；
- label 变化不破坏业务判断；
- 禁用与删除的历史数据语义明确；
- 管理动作检查 `dictionary.manage` 并写审计；
- 缓存有可靠的租户隔离和失效机制；
- 其他模块只依赖 public query/事件，不读表；
- 新增 HTTP 接口同步更新系统 API 文档。
