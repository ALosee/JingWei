# SoybeanUI 上游参考

本项目使用 SoybeanUI 的公开资料辅助建设 `@jingwei/ui`。SoybeanUI 提供上游组件源码、
headless 行为和主题系统，Jingwei 拥有最终组件 API、组合方式与必要的样式调整。

## 固定版本

| 项目           | 值                                                               |
| -------------- | ---------------------------------------------------------------- |
| 上游仓库       | `soybeanjs/soybean-ui`                                           |
| Skill 版本     | `v0.30.0`                                                        |
| Git tag object | `5e3d045d94218405b98b4106b445769d033a4883`                       |
| 上游 commit    | `90fcca22b336d658bddd35ea3bc0cb0f05587487`                       |
| License        | MIT                                                              |
| 引入日期       | 2026-09-07                                                       |
| 本地使用者知识 | `.agents/skills/soybean-headless/`、`.agents/skills/soybean-ui/` |

Skill 快照与项目固定的 SoybeanUI `0.30.0` 源码模板对齐。当前使用
`@soybeanjs/headless`、`@soybeanjs/theme`、`@soybeanjs/ui-uno`、`@soybeanjs/cva` 和 `sbean`；
所有包通过根 catalog 固定为 `0.30.0` 或同版本配套版本。styled `@soybeanjs/ui` 不作为依赖，
所需 styled wrapper 由 sbean 生成并归仓库所有。

上游生成内容中的 6 个站点相对链接在项目本地无法解析。本地快照只对这些链接做了
修正，将它们改为 `ui.soybeanjs.cn` 的绝对地址；其余上游 Skill 内容保持不变。

## 文档入口

- 精简索引：<https://ui.soybeanjs.cn/llms.txt>
- 完整文档：<https://ui.soybeanjs.cn/llms-full.txt>
- 单组件文档：`https://ui.soybeanjs.cn/components/{name}.md`
- 固定版本源码：<https://github.com/soybeanjs/soybean-ui/tree/v0.30.0>
- v0.30.0 Release：<https://github.com/soybeanjs/soybean-ui/releases/tag/v0.30.0>

通常先读取本地 Skill，再按任务读取一个具体组件文件。只有本地资料不足时才读取
在线 `llms.txt`；`llms-full.txt` 只用于确实需要全量 API 上下文的任务，不在仓库中保存
它的易过期副本。

## Jingwei 覆盖规则

上游 `soybean-ui` Skill 会推荐直接使用 `@soybeanjs/ui` 的 `S*` 组件。Jingwei 的约定是：

- 业务模块只从 `@jingwei/ui` 导入共享组件；
- `@soybeanjs/headless` 只作为 `@jingwei/ui` 内部实现依赖；
- sbean 生成文件保持上游目录及 `S*` 内部名，只在 `@jingwei/ui` 公共入口映射无前缀名称；
- 全局主题由 `packages/platform/ui/sbean.json`、`@soybeanjs/ui-uno` 的 `presetSbean()` 和
  `@soybeanjs/theme` 生成，组件直接使用 Soybean 的语义 token，不建立平行的项目变量层；
- Jingwei 可通过 Soybean 的主题 seed 与 override API 定制品牌主题；
- 不引入上游 `.agents/skills/soybean-ui-component-development`，因为它约束的是
  SoybeanUI 仓库自身的目录、生成和发布流程。

发生冲突时，依次以根 `AGENTS.md`、已接受 ADR、`jingwei-ui-development` Skill 和本文件
为准，上游 Skill 仅提供组件 API 与实现参考。

## 更新流程

1. 确认准备采用的 `@soybeanjs/headless` 版本和对应 Git tag。
2. 阅读从当前固定版本到目标版本的 release notes 和 diff。
3. 从同一 tag 更新 `soybean-headless` 与 `soybean-ui` 两个消费者 Skill，保留 MIT License。
4. 更新本页的版本、commit 和日期。
5. 校验三个本地 Skill，并检查 Jingwei 的覆盖规则是否仍与上游建议兼容。

不要单独更新 `soybean-headless` Skill。它的组件索引引用
`soybean-ui/components/*.md`，两份消费者 Skill 必须保持相同版本。

## 运行时主题基础设施

`ConfigProvider`、`useTheme`、Toast/Dialog/Progress Provider 与主题设置面板均由
`@jingwei/ui` 源码拥有，不依赖上游 styled 包，也不另建 Pinia 主题 store。内部文件保留
sbean 的 `SConfigProvider` 名，公共入口导出 `ConfigProvider`。Web 壳拥有主题设置入口与
弹窗容器。`presetSbean()` 负责构建回退主题，运行时配置与持久化由本地 Provider 管理。

Playground 只作为实现参考：本地 `/Users/jack/code/soybean-ui/apps/playground` 的 App.vue、
theme.ts 和 theme-configurator.vue。本地 checkout 为 0.31.0，实际生成模板与依赖仍固定在
已发布的 0.30.0。
