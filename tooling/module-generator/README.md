# `@jingwei/module-generator`

创建符合 Jingwei 目录和导出约定的业务模块骨架。生成器只负责完整起点，不替代模块边界设计。

## 运行

```bash
pnpm module:create customer-profile
```

module id 必须是 kebab-case：以小写字母开头，只包含小写字母、数字和连字符。目标目录已存在时命令失败，不覆盖任何文件。

## 生成内容

```text
packages/modules/<id>/
├── migrations/index.ts
├── src/
│   ├── client/index.ts
│   ├── manifest.ts
│   ├── server/
│   │   ├── api/
│   │   ├── application/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   ├── public/
│   │   ├── index.ts
│   │   └── module.ts
│   ├── shared/index.ts
│   └── web/
│       ├── components/
│       ├── composables/
│       ├── pages/
│       ├── index.ts
│       └── module.ts
├── README.md
├── package.json
└── tsconfig.json
```

package exports 显式列出 manifest、shared、server、server/public、client、web 和 migrations，不使用通配导出。

## 生成后的必做工作

1. 把 manifest 展示名和 category 改为真实业务定义；
2. 说明职责、非职责和数据所有权；
3. 声明必需/可选模块依赖；
4. 设计 capability、permission 和 route definition；
5. 实现 Server/Web module；
6. 定义最小 public API 或事件契约；
7. 新增向前迁移和测试；
8. 把模块加入需要它的 Edition；
9. 运行生成、架构检查、类型检查和构建；
10. 完整填写模块 README，不保留空章节。

## 边界

生成器不会：

- 自动选择其他模块依赖；
- 创建业务表和 CRUD；
- 把模块加入全部 Edition；
- 决定权限和数据范围；
- 修改根依赖或安装新的 npm 包。

这些都需要模块作者做显式设计。详细流程见 [开发指南](../../docs/development-guide.md)。

## 维护生成器

职责分为三层：`cli.ts` 只调用 `commands/create.ts`；命令解析输入、选择仓库路径并输出结果；`generate.ts` 验证目标并创建文件，`templates.ts` 的 `moduleFiles(moduleId)` 只返回内容。导入这些实现不会创建目录。

生成的 README 会提示 server/module.ts 只装配、HTTP handler 位于 api、页面网络流程位于 composables。生成器不自动创建万能 service 或无实际规则的抽象层，遵守 [代码职责约束](../../docs/code-structure.md)。

模板变更后要运行 `generate.test.ts`，并生成一个临时示例模块验证 package、tsconfig、Server/Web 入口、架构检查和类型检查。测试只在自身临时目录操作，验证结果可复现、拒绝非法 ID 和覆盖已有模块。不要把测试示例永久加入产品 Edition。
