# Editions

Edition 是 Jingwei 的产品组合定义：选择根模块以及可选 capability，构建工具据此计算传递依赖并生成 Server、Web 和迁移入口。

详细语义见 [Edition 与 Module 手册](../docs/edition-module-handbook.md)。

## 当前 Edition

| 文件 | ID | 用途 | 当前根模块 |
| --- | --- | --- | --- |
| `development.ts` | `development` | 本地开发和默认质量验证 | iam、organization、navigation、dictionary |
| `full.ts` | `full` | 当前完整产品组合 | iam、organization、navigation、dictionary |

两个 Edition 当前内容相同是初始化阶段的结果，不表示它们应该永久同步。未来差异必须来自明确的交付场景。

## 定义格式

```ts
export default defineEdition({
  id: 'full',
  modules: {
    iam: true,
    organization: true,
    navigation: true,
    dictionary: {
      capabilities: ['dictionary.read'],
    },
  },
})
```

- `true`：启用模块声明的全部 capability；
- `{ capabilities: [...] }`：只启用列出的 capability；
- 模块必需依赖会自动加入；
- 未知模块、未知 capability、缺失 capability 依赖或循环依赖会导致生成失败。

## 设计规则

- Edition 只列产品主动选择的根模块，不手工重复传递依赖；
- 不能在 Edition 中覆盖模块 manifest 的依赖关系；
- Edition ID 是稳定构建标识，使用小写字母、数字和连字符；
- Server、Web、迁移必须由同一次解析结果生成；
- 生产制品应只包含选中模块，实现物理裁剪；
- 用户授权、租户配置和运行时 feature flag 不属于 Edition 定义。

## 新增 Edition

1. 明确目标客户/部署场景与产品差异；
2. 新建 `<edition-id>.ts` 并调用 `defineEdition`；
3. 只选择必要根模块和 capability；
4. 运行 Edition Builder；
5. 检查生成的模块拓扑、迁移和最终 bundle；
6. 执行类型、架构、生产启动和 E2E；
7. 在本 README 记录用途和支持策略。

如果新增 Edition 只是为了临时绕过失败测试或部署配置，应改用正确的测试 fixture/环境配置，而不是制造新的产品变体。

## 变更检查表

- 变更后的依赖闭包符合预期；
- 模块迁移与运行时代码一致；
- Navigation 不会返回被裁剪模块的页面；
- 物理 bundle 不包含未选模块；
- 升级/降配后的数据保留策略已说明；
- 对应部署和支持文档已更新。
