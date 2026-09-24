# `@jingwei/module-branding`

Branding 是租户品牌与展示默认配置的 Owner Module。它让不同客户独立配置系统名称、登录页文案、
工作区 Logo/方形标志、浏览器 favicon、视觉主题和工作区默认布局，同时保持发布历史、权限、审计和
匿名启动读取的一致边界。

## 职责与非职责

本模块负责：

- 租户品牌草稿、不可变发布版本、显式回滚、恢复平台默认和乐观并发；
- 有界 PNG、严格白名单 Logo/Mark SVG 与 Favicon ICO 的内容、尺寸和用途校验；
- 匿名生效品牌投影，以及管理端的版本与素材 API；
- 品牌主色/基础中性色的内置或自定义 50–950 色阶、组件圆角和侧栏配色；
- 浅色/深色的表面、文字、交互、侧栏、状态和图表语义色稀疏覆盖；
- 菜单模式、品牌位置、头部高度、侧栏宽度和页签可见性的租户默认值；
- `branding.view`、`branding.manage`、`branding.publish` 授权和关键写操作审计；
- 品牌管理页面及前端生效品牌状态。

本模块不负责 Navigation 路径/菜单、IAM 登录规则、用户个人明暗模式/界面尺寸/布局覆盖、任意
CSS/HTML/选择器、客户专属代码分支或通用键值设置。Web 壳负责把品牌投影组合到页面标题、favicon、主题和
全局 chrome，并将用户稀疏覆盖叠加在租户工作区默认值上；IAM 仅拥有登录页需要的窄展示端口。边界
决策见 [ADR 0016](../../../docs/adr/0016-own-tenant-branding-in-a-dedicated-module.md) 和
[ADR 0019](../../../docs/adr/0019-layer-tenant-presentation-defaults-and-user-preferences.md) 与
[ADR 0020](../../../docs/adr/0020-model-tenant-themes-as-palettes-and-semantic-overrides.md)。

## Manifest

模块 ID 为 `branding`，分类为 `foundation`，必需依赖 `iam`，因为管理用例通过 IAM Public API
执行功能授权。`branding.core` capability 包含三个无数据范围权限和 `branding.manage` route。
Manifest 只描述稳定 metadata，不读取数据库或安装运行时。

## 数据所有权

初始迁移为 `migrations/20260917090000_branding_foundation.ts`，展示默认字段由
`migrations/20260922100000_branding_tenant_presentation.ts` 与
`migrations/20260922110000_branding_semantic_theme.ts` 演进；模块拥有 PostgreSQL
`branding` schema：

- `brand_profile`：每个租户唯一根和当前发布指针；
- `brand_version`：草稿与不可变发布快照，按租户递增 revision；
- `brand_asset`：按租户、用途和 SHA-256 去重的已验证 PNG/SVG/ICO 字节及尺寸 metadata。

所有管理查询和写入都包含 `tenant_id`。版本对素材使用租户内复合外键，发布指针只能指向同一 profile
的版本。发布/回滚锁住根记录；草稿保存和发布均比较 `edit_revision`。公开素材 URL 使用不可猜测 UUID，
素材按产品定义属于公开展示内容，不得上传密钥、内部文档或个人信息。

## 代码结构

- `server/domain/brand-image.ts`：PNG 结构、CRC、SVG 安全配置和用途尺寸规则；
- `shared/brand-theme-validation.ts`：浏览器提示与发布共用的色阶顺序、生效对比度纯校验；
- `server/application`：品牌查询、草稿/发布事务、权限和存储端口；
- `server/infrastructure/branding-store.pg.ts`：Kysely 存储与审计事务适配器；
- `server/api`：Zod OpenAPI 契约和 thin Hono route；
- `client`：模块级 OpenAPI typed client；multipart 上传复用平台请求管线；
- `web/composables`：管理页面的加载、保存、发布和上传状态；
- `web/state.ts`：只读生效品牌投影，由 Web 组合根更新。

`server/module.ts` 只负责装配；页面不直接请求 HTTP。当前无服务端跨模块 Public API，也不发布
Integration Event；匿名 HTTP 投影是 Web/其他客户端的稳定消费边界。

## HTTP 与权限

| Method | Path                                      | Access             | 用途                  |
| ------ | ----------------------------------------- | ------------------ | --------------------- |
| GET    | `/api/v1/branding/bootstrap`              | Public             | 读取租户生效品牌      |
| GET    | `/api/v1/branding/assets/{id}`            | Public             | 读取不可变品牌素材    |
| GET    | `/api/v1/branding/admin`                  | `branding.view`    | 版本概览              |
| GET    | `/api/v1/branding/versions/{id}`          | `branding.view`    | 版本详情              |
| POST   | `/api/v1/branding/drafts`                 | `branding.manage`  | 从默认/指定版本建草稿 |
| PUT    | `/api/v1/branding/versions/{id}`          | `branding.manage`  | 保存草稿              |
| DELETE | `/api/v1/branding/versions/{id}`          | `branding.manage`  | 删除草稿              |
| POST   | `/api/v1/branding/assets`                 | `branding.manage`  | 上传品牌素材          |
| POST   | `/api/v1/branding/versions/{id}/publish`  | `branding.publish` | 发布草稿              |
| POST   | `/api/v1/branding/versions/{id}/rollback` | `branding.publish` | 切换到历史发布版本    |
| POST   | `/api/v1/branding/restore-default`        | `branding.publish` | 恢复平台默认品牌      |

已登录 bootstrap 始终使用 Session tenant；匿名请求只允许通过 `tenantCode` 或服务器
`BOOTSTRAP_TENANT_CODE` 解析活跃租户。mutation 继续受全局 Origin/CSRF 中间件保护。

## 关键语义

- 未发布任何版本时返回代码内置的 Jingwei 默认品牌，登录和恢复页不会因此不可用；
- 新草稿来源必须显式选择平台默认或一个租户内版本，不用 null 隐式代表当前线上版本；
- 横向品牌显示显式选择平台内置字标、系统简称或自定义 Logo；发布版本不再根据素材是否存在隐式推断；
- 自定义 Logo 可保持原色，也可用同一素材作为 CSS mask 生成单色剪影并跟随亮色/暗色主题；
- 自定义方形标志按素材原有透明度和颜色展示，不继承平台默认标志的底板、圆角或阴影；
- 视觉主题与工作区默认布局属于同一个版本快照，随草稿发布、历史回滚和审计原子切换；
- 已发布主题的自定义色板由租户壳显式注册，主题选项计算保持纯函数；草稿预览复用临时色板键，
  不随每次逐级调色无限增加运行时注册项；
- 生效投影提供受约束的完整色阶、命名方案与语义角色覆盖；颜色只能是色阶引用或受验证的
  HSL/OKLCH 值，不接受任意 CSS、变量、URL、选择器或脚本；用户明暗模式和界面尺寸不写入品牌版本；
- 管理页按品牌标识、名称与文案、视觉主题、工作区布局切换编辑分区，保存/发布操作保持可见；视觉主题再按中性色、主色、界面风格和高级语义色分区，窄屏预览可按需展开；
- 编辑器将选预设色系、为具体语义角色选 50–950 深浅、给单一角色输入自定义颜色、逐级编辑色阶
  分成独立操作。整套色阶在独立编辑窗中逐级调整，打开编辑窗不修改草稿；首次改色时精确复制当前预设。
  选择色阶不重建色板，改变生成基准色也须显式确认重建；
  已发布的 V2 色板和角色引用继续按原契约读取，无需另建版本或迁移；
- 主题引擎会从浅色语义覆盖推导深色颜色；即使没有显式深色覆盖，深色实际效果也可能变化。
  色阶卡片显示对应深色结果与前景对比度，并可直接切换到深色设置；发布仍校验实际生效的组合，
  不因深色未显式覆盖而跳过低对比度问题；
- 工作区用户覆盖由 Web 以租户和用户为命名空间稀疏保存，未覆盖字段持续跟随当前发布版本；
- 草稿变化不影响线上品牌，发布后新页面加载使用新投影；
- 已发布版本由数据库触发器保护，不允许修改或删除；回退通过将线上指针切到历史已发布版本完成；
- 恢复平台默认会清空当前发布指针并保留全部已发布历史，不依赖删除版本；
- 发布指针和审计处于同一事务；指针或编辑 revision 冲突返回 409，客户端必须重新加载；
- 素材不超过 2 MiB；横向 Logo 宽高比为 1:1–12:1，并接受 PNG 或
  `BRAND_LOGO_SVG_V2` 静态绘图子集；方形标志接受 32–512 像素的正方形 PNG，或同子集且
  `viewBox` 为正方形的 SVG（SVG 坐标不是像素，不套用 PNG 尺寸范围）；Favicon 接受
  16–512 正方形 PNG，或带 16–256 正方形 PNG/DIB 帧的标准 ICO（新上传使用 `ICO_V2`，
  历史 `ICO_V1` 素材继续可读）；
  SVG 支持基本图形、内部 `clipPath`、渐变和蒙版；出现未知元素/属性、脚本、事件、外链、DOCTYPE
  或 Entity 时整份拒绝且不入库，服务端验证实际字节而不信任浏览器 MIME；
- 生效品牌中的 SVG 会在进入 Web 全局品牌状态前按同一配置再次校验；失败时只回退横向展示，
  不阻断登录或动态导航启动；
- V1 将小型素材存入 PostgreSQL，不引入尚无运行时需求的对象存储。

## 当前实现状态

草稿、保存、发布、回滚、恢复默认、PNG/Logo/Mark SVG/ICO 上传、公开投影、管理页、登录页、工作区品牌、
租户视觉主题/布局默认值和浏览器 metadata 均已实现。当前不包含即时推送、用户偏好跨设备同步、字段
锁定、按组织或角色设置布局、按语言拆分品牌文案、WebP、自定义邮件/文档模板或对象存储迁移。

修改后至少运行模块类型检查和相关 Vitest；提交前必须在仓库根目录运行 `pnpm check`。
