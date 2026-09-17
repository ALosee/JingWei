/** Pure scaffold description. No filesystem writes or process inputs belong in templates. */
export function moduleFiles(moduleId: string): Readonly<Record<string, string>> {
  const packageJson = {
    name: `@jingwei/module-${moduleId}`,
    version: '0.0.0',
    private: true,
    type: 'module',
    exports: {
      './manifest': './src/manifest.ts',
      './shared': './src/shared/index.ts',
      './server': './src/server/index.ts',
      './server/public': './src/server/public/index.ts',
      './openapi': './src/server/api/openapi.ts',
      './client': './src/client/index.ts',
      './web': './src/web/index.ts',
      './migrations': './migrations/index.ts',
    },
    scripts: { typecheck: 'tsc -p tsconfig.json' },
    dependencies: {
      '@jingwei/module-sdk': 'workspace:*',
    },
    devDependencies: {
      '@types/node': 'catalog:',
      typescript: 'catalog:',
    },
  }

  const manifest = `import { defineModule } from '@jingwei/module-sdk'\n\nexport const manifest = defineModule({\n  id: '${moduleId}',\n  name: '${moduleId}',\n  category: 'business',\n  dependencies: [],\n  optionalDependencies: [],\n  capabilities: [],\n  permissions: [],\n  routeDefinitions: [],\n})\n`

  const serverModule = `import { createApiRouter, type ServerModule } from '@jingwei/module-sdk/server'

import { manifest } from '../manifest.js'

export const serverModule: ServerModule = {
  manifest,
  install() {
    return Promise.resolve({
      id: manifest.id,
      basePath: '/${moduleId}',
      routes: createApiRouter(),
    })
  },
}
`

  const openApi = `export const openApiContract = {
  id: '${moduleId}',
  title: '${moduleId}',
  basePath: '/${moduleId}',
  routes: [],
} as const
`

  const webModule = `import type { WebModule } from '@jingwei/module-sdk/web'

import { manifest } from '../manifest.js'

export const webModule: WebModule = {
  manifest,
  pages: [],
}
`

  const files: Readonly<Record<string, string>> = {
    'package.json': `${JSON.stringify(packageJson, null, 2)}\n`,
    'tsconfig.json': `${JSON.stringify(
      {
        extends: '../../../tsconfig.base.json',
        compilerOptions: { rootDir: '../../..' },
        include: ['src/**/*.ts', 'migrations/**/*.ts'],
      },
      null,
      2,
    )}\n`,
    'src/manifest.ts': manifest,
    'src/shared/index.ts': 'export {}\n',
    'src/server/public/index.ts': 'export {}\n',
    'src/server/api/openapi.ts': openApi,
    'src/server/index.ts': "export { serverModule } from './module.js'\n",
    'src/server/module.ts': serverModule,
    'src/client/index.ts': 'export {}\n',
    'src/web/index.ts': "export { webModule } from './module.js'\n",
    'src/web/module.ts': webModule,
    'migrations/index.ts': 'export const migrations = {} as const\n',
    'README.md': `# ${moduleId} 模块

包：@jingwei/module-${moduleId}；模块 ID：${moduleId}。

用一段话说明本模块为谁解决什么业务问题，以及它在系统中的位置。

## 职责与非职责

本模块负责：

- 列出本模块拥有的业务能力与规则。

本模块不负责：

- 明确相邻但属于其他模块的能力，防止边界扩散。

## Manifest

记录 category、required/optional dependencies、capabilities、permissions 和 routes，并解释每项为什么存在。

## 数据所有权

列出本模块拥有的 Schema/Table、关键约束、租户隔离策略和迁移入口。没有持久化数据时明确写“无”。

## 代码结构

解释 domain、application、infrastructure、api、public、client、web 中的关键入口。

server/module.ts 只装配依赖与路由；HTTP handler 放在 server/api，规则与事务放在 application/domain，SQL 放在 infrastructure。web/pages 负责展示和绑定，网络流程与提交状态放在模块自有 web/composables，不直接调用 client。具有本模块业务词汇的组件放 web/components；无业务基础组件从 @jingwei/ui 导入，不把业务组件下沉到平台 UI。避免导入时自动执行 I/O，参照仓库 docs/code-structure.md、ADR 0008 与 ADR 0010。

## HTTP 与 Client API

在 server/api/openapi.ts 中使用 createApiRoute 列出每个端点、输入、输出、授权契约和稳定错误码；运行 pnpm api:generate 后在 module client 使用生成的 typed client。没有端点时明确写“无”。

## Public API 与事件

列出允许其他模块依赖的最小同步契约，以及发布/消费的 Integration Event。禁止把内部仓储重新导出。

## 关键流程与不变量

解释租户、安全、事务、审计、outbox、并发和失败语义。

## 当前实现状态

区分已实现能力、骨架/占位和明确的后续工作，不把目标设计描述成现状。

## 修改检查表

- 数据访问包含租户范围；
- 服务端执行 permission/data scope；
- 跨模块只使用 public contract 或事件；
- 入口与装配不混入功能实现，页面与提交流程有明确状态所有者；
- pnpm architecture:check 通过，新增边界规则附带合法与非法测试；
- 代码、测试、迁移和文档同步更新。
`,
  }
  return files
}
