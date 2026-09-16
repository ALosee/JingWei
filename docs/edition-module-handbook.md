# Edition 与 Module 完整手册

Edition 和 Module 是经纬最重要、也最容易被误解的两个概念。本手册从产品模型、代码定义、构建产物、运行时行为和常见错误五个角度解释它们。

## 1. 从产品到数据范围

经纬采用以下固定解析顺序：

```text
Product
  -> Edition
    -> Module
      -> Capability
        -> Permission
          -> Data Scope
```

每一层回答不同的问题：

| 层级       | 回答的问题                         | 发生时间       |
| ---------- | ---------------------------------- | -------------- |
| Product    | 这是哪个产品族？                   | 商业与产品规划 |
| Edition    | 本次交付物包含哪些模块和能力？     | 构建时         |
| Module     | 哪个业务边界拥有代码、数据和规则？ | 设计时与运行时 |
| Capability | 已启用模块中的哪组可选能力可用？   | 构建时/启动时  |
| Permission | 当前用户能执行哪个动作？           | 请求运行时     |
| Data Scope | 获得动作权限后能处理哪些数据行？   | 请求运行时     |

禁止跨层替代。例如：

- 隐藏菜单不能替代 Permission。
- Permission 不能让未进入 Edition 的 Module 复活。
- Capability 不能表达某个用户是否有权限。
- Edition 不能保存 Tenant 自定义菜单顺序。

## 2. Module 是业务所有权边界

Module 不是文件夹标签，也不是一组页面。一个 Module 同时拥有：

- 业务术语和规则；
- Application Use Case；
- PostgreSQL Schema 与 Migration；
- 对外 Public API / Integration Event；
- Hono Sub-App；
- Web 页面与客户端合约；
- Capability、Permission 和 Route Definition metadata；
- 自己的 README、测试和演进责任。

例如 IAM 拥有 `iam.user`、Credential、Role 与 Permission Projection，但不拥有 Employee、Organization Tree 或 Tenant Navigation。即使 UI 把这些功能都显示在“系统管理”下，它们仍属于不同 Module。

## 3. Module Manifest

每个模块的 `src/manifest.ts` 通过 `defineModule()` 声明纯 metadata：

```ts
export const manifest = defineModule({
  id: 'example',
  name: '示例模块',
  category: 'business',
  dependencies: ['iam'],
  optionalDependencies: [],
  capabilities: [{ id: 'example.core', name: '核心能力' }],
  permissions: [
    {
      code: 'example.view',
      name: '查看示例',
      dataScope: { allowedTypes: ['ALL', 'SELF'] },
    },
  ],
  routeDefinitions: [
    {
      key: 'example.list',
      page: 'ExampleList',
      layout: 'base',
      allowedAccessModes: ['PERMISSION'],
      requiredCapability: 'example.core',
      requiredPermission: 'example.view',
    },
  ],
})
```

Manifest 必须满足：

- `id` 使用稳定 kebab-case；发布后不因显示名称变化而修改。
- Permission 和 routeKey 以模块 ID 为前缀。
- Capability ID 在整个 Edition 中可稳定引用。
- Required Dependency 表示缺少依赖模块时本模块不能成立。
- Optional Dependency 表示代码可以检测并增强，但核心语义不依赖它。
- Manifest 不读取环境变量、数据库，不创建 Service，不 import Vue 页面。

Permission 省略 `dataScope` 时只允许 `ALL`。需要组织事实的 Permission 显式声明 provider；对应模块通过 `dataScopeProviders` 声明 provider 所有权。Edition Resolver 会拒绝缺少 provider 的产品组合。

模块还可以通过与 `routeDefinitions` 独立的 `navigationItems` 提供初始导航建议。它必须显式声明 MENU/PAGE、名称、路径、父 code 和展示属性；Route 存在并不自动意味着应该生成菜单。

`defineModule()` 会验证 ID、重复 Capability/Permission/Route、Permission/Route 所有权、数据范围类型/provider、navigationItems 对 Route 的引用、requiredCapability 和 requiredPermission 是否存在，以及 PUBLIC Route 是否错误绑定 Permission。

## 4. Dependency 与 DAG

Module Dependency 表示业务语义依赖，不只是 npm package dependency。

```text
navigation -> iam
organization -> iam
dictionary -> iam
```

依赖图必须是有向无环图。Edition Resolver 使用拓扑排序保证依赖模块先装配。出现 `A -> B -> A` 时构建失败，而不是在运行时靠初始化顺序碰运气。

依赖声明与代码引用必须一致：

- import 其他 Module 的 Public API，Manifest 必须声明 dependency。
- package.json 引用其他 Module，也必须有 Manifest dependency。
- 声明 dependency 不等于允许访问对方 repository、schema 或内部 Application Service。
- 跨模块仍只能使用 `shared`、`client`、`server/public`、Manifest 或 Integration Event。

## 5. Capability

Capability 是 Module 内的可裁剪功能组。它适合表达“同一模块在不同 Edition 中交付不同能力”，而不是表达用户权限。

Edition 可以选择模块全部 Capability：

```ts
modules: {
  iam: true
}
```

也可以只选择指定 Capability：

```ts
modules: {
  iam: { capabilities: ['iam.authentication'] },
}
```

Resolver 会拒绝不存在的 Capability。Route Definition 若声明 `requiredCapability`，只有该 Capability 启用时 Route 才能成为有效配置。

## 6. Edition 是静态交付定义

Edition 是 TypeScript 构建输入，定义在 `editions/*.ts`：

```ts
export default defineEdition({
  id: 'development',
  modules: {
    iam: true,
    navigation: true,
  },
})
```

Edition 不是：

- Tenant 数据库配置；
- Feature Flag 服务；
- 菜单树；
- 用户权限集合；
- 运行时动态安装插件。

选择 Edition 后，交付内容应是确定、可复现、可审计的。删除或停用 Module 不会自动删除历史数据库 Schema。

## 7. Edition 解析算法

`resolveEdition()` 的逻辑顺序：

1. 校验 Module Catalog 中没有重复 ID。
2. 读取 Edition 显式选择。
3. 递归加入 required dependencies。
4. 检测循环依赖与未知模块。
5. 对选择集进行拓扑排序。
6. 解析每个 Module 的 Capability 选择。
7. 验证 Capability 对 Module 的额外依赖。
8. 校验 Permission 所需 Data Scope provider 已进入 Edition。
9. 按启用 capability 组合模块 navigationItems 与 Edition 公共容器/入口。
10. 返回不可依赖源目录扫描顺序的 `ResolvedEdition`。

返回值中每个 `ResolvedModule` 包含 Manifest 和 `enabledCapabilities`。运行时 `ModuleRegistry` 只从该结果构造 Route/Permission/Capability 视图。

## 8. Edition Builder 产物

执行：

```bash
pnpm edition:generate development
```

生成：

| 文件                                        | 用途                                             |
| ------------------------------------------- | ------------------------------------------------ |
| `apps/server/src/generated/edition.ts`      | 运行时 Resolved Edition                          |
| `apps/server/src/generated/modules.ts`      | Hono Server Module 装配顺序与显式跨模块依赖注入  |
| `apps/server/src/generated/migrations.ts`   | 静态 Migration Registry                          |
| `apps/web/src/generated/modules.ts`         | Web Module/Page Binding 与显式 Vue provider 注入 |
| `apps/web/src/generated/elegant-router.ts`  | Elegant Router 可扫描的 pageDir                  |
| `apps/web/src/router/_generated/imports.ts` | 类型检查占位，dev/build 时由 Elegant Router 替换 |

这些文件禁止人工修改。任何差异都必须追溯到 Edition、Manifest 或 Builder 本身。

## 9. 物理裁剪如何发生

Edition Builder 只把启用 Module 的 `src/web/pages` 写入 Elegant Router `pageDir`。Elegant Router 再生成 lazy import registry。因此未启用模块的页面不会进入 Vite Module Graph，也不会产生 chunk。

Server 和 Migration 同样由生成 Registry 静态 import。物理裁剪的目标是：

```text
未启用 Module
  -> 无 Server Module import
  -> 无 Web Module/Page import
  -> 无新 Migration import
  -> 无 Route/Permission runtime projection
```

数据库中已存在的历史表不会因为裁剪而删除。

## 10. Server Module 与 Web Module

`ServerModule` 是 Composition Root 使用的安装契约：

```ts
interface ServerModule {
  manifest: ModuleManifest
  install(context: ServerModuleContext): Promise<InstalledServerModule>
}
```

`install()` 只能进行当前模块的显式依赖装配，返回 Hono Sub-App 和 basePath。它不应启动全局定时器或查找其他模块内部实现。

`WebModule` 将稳定 routeKey 绑定到 Elegant Router 生成的 pageKey：

```ts
interface WebModule {
  manifest: ModuleManifest
  pages: readonly PageBinding[]
}
```

pageKey 是构建期 component registry key；routeKey 是业务稳定身份。最终 URL 属于 Tenant Navigation。

## 11. 运行时 ModuleRegistry

`ModuleRegistry` 提供只读查询：

- `editionId`：当前交付 Edition；
- `hasModule(id)`：模块是否进入交付物；
- `hasCapability(id)`：Capability 是否启用；
- `route(routeKey)`：获取代码声明的安全 Route Definition；
- `permission(code)`：获取 Manifest Permission Definition；
- `routes()`：列出当前 Edition 的所有 Route Definition。

它不是 Service Locator，不保存 repository 或 use case，也不能用于绕过构造函数注入。

## 12. 常见错误

### 用菜单开关替代 Edition

菜单只影响显示，代码和权限仍存在，不构成物理裁剪。

### 把 Capability 当 Permission

Capability 决定交付能力，Permission 决定当前用户动作，两者生命周期不同。

### 在 Manifest 中读取环境变量

这会使构建不可复现，也让 Module Catalog 依赖运行环境。

### 为了复用直接 import 其他模块 infrastructure

这破坏所有权。应定义 Public Query Port、API Contract 或 Integration Event。

### 修改 generated 文件解决问题

下次生成会覆盖，且其他 Edition 无法复现。应修正输入或生成器。

## 13. 增加 Edition 或 Module 的检查清单

- Module ID、package name、目录名一致。
- Manifest dependency 与实际引用一致。
- Capability、Permission、routeKey 命名稳定且唯一。
- Route 安全模式不能被 Navigation 降级。
- Module 有 owned schema/migration 或明确说明无持久化数据。
- Server/Web Module 有显式 exports。
- Edition 构建后检查生成 Registry 和前端 chunk。
- 运行 `pnpm check`，必要时增加物理裁剪集成测试。
