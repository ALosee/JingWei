# SoybeanUI 上游参考

本项目使用 SoybeanUI 的公开资料辅助建设 `@jingwei/ui`。SoybeanUI 是上游源码与
headless 行为参考，Jingwei 自己拥有最终组件 API、设计 token 和 UnoCSS 视觉实现。

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

Skill 快照与当前 npm 最新稳定版本 `@soybeanjs/headless@0.30.0` 对齐。这里只固定了
AI 使用的知识文件；运行时依赖、UnoCSS 和 `sbean` CLI 将在设计系统实施时单独引入并
记录版本。

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
- 从 SoybeanUI 复制 styled wrapper 和样式 recipe 后，改为无前缀的 Jingwei 公共组件名；
- 设计 token、主题语义和 UnoCSS 配置由 Jingwei 定义；
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
