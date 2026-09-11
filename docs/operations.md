# 运维与部署手册

本文覆盖 Jingwei 从配置、迁移、构建到运行诊断的标准操作。示例以本地开发为主；生产环境应由部署平台注入 Secret、网络和持久化策略。

## 1. 运行组件

最小部署由以下部分组成：

- Web 静态资源或 Web 开发服务器；
- Node.js Server 进程；
- PostgreSQL；
- Outbox worker（当前可随 Server 生命周期运行，规模扩大后可拆为独立进程）；
- 日志采集与健康探针。

Edition 在构建前确定进入制品的模块集合。不要用同一个含全部模块的镜像，仅靠运行时变量假装完成物理裁剪。

## 2. 配置原则

配置由 `@jingwei/config` 在进程启动时集中读取和验证。业务模块不得直接读取环境变量。

应管理的配置类别：

| 类别         | 示例                                             | 生产要求                                                      |
| ------------ | ------------------------------------------------ | ------------------------------------------------------------- |
| 运行环境     | `NODE_ENV`                                       | 明确设置为 production                                         |
| 监听         | host、port                                       | 与容器和探针对齐                                              |
| 数据库       | PostgreSQL URL                                   | 通过 Secret 注入，启用 TLS/网络隔离                           |
| 日志         | level                                            | 默认结构化输出，不记录 Secret                                 |
| 会话         | Access/Refresh 有效期、复用窗口、Cookie 安全属性 | HTTPS 下启用 Secure，使用强随机令牌                           |
| 登录防护     | 失败阈值、账号锁定时长                           | 结合边缘 IP 限流监控异常尝试                                  |
| Web 来源     | allowed origins                                  | 精确白名单，不使用任意通配                                    |
| 匿名启动租户 | BOOTSTRAP_TENANT_CODE                            | 必须指向活跃真实租户，默认 default；已登录使用 Session tenant |
| Edition      | development/full 等                              | 构建和迁移使用同一值                                          |

完整变量名和默认值以 `platform/config` 的 schema 为准。部署模板引用配置时，应在 CI 中执行一次启动验证，防止拼写错误直到生产才暴露。

## 3. 本地运行

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d postgres
pnpm edition:generate development
pnpm migration:up
DEV_ADMIN_PASSWORD='<至少 12 个字符>' pnpm seed:dev
pnpm seed:navigation
pnpm dev
```

`seed:dev` 和 `seed:navigation` 仅用于本地非生产环境；正式环境必须通过受控初始化或用户管理流程建立首个管理员，不能使用开发种子。已有用户只初始化导航时不要重跑 seed:dev（会更新密码）。一次性 CLI 须显式加载环境，见 [迁移工具](../tooling/migration/README.md#显式使用-envtest)。

日常 `pnpm dev` 从仓库根目录读取 `.env`、`.env.local`、`.env.development` 和 `.env.development.local`；测试联调使用 `pnpm dev:test`，只加载 `.env.test`。文件名代表运行模式，不是任意别名，因此创建 `.env.test` 后仍执行 `pnpm dev` 不会改变 Server 的数据库连接。

停止本地数据库：

```bash
docker compose -f docker-compose.dev.yml stop postgres
```

删除数据库卷会丢失本地数据，因此不属于普通停止流程。

## 4. 迁移

### 4.1 执行前

- 确认目标数据库和 Edition；
- 备份关键数据并验证恢复路径；
- 确认应用版本与迁移版本配套；
- 检查长事务、锁表和回填成本；
- 对不可向后兼容的变更制定分阶段发布方案。

### 4.2 顺序

Edition Builder 先解析模块闭包，再由迁移工具按稳定顺序收集各模块迁移。迁移成功后才启动依赖新结构的应用版本。

生产建议：

1. 扩展：新增可空列、新表或兼容索引；
2. 发布可同时读写新旧结构的代码；
3. 回填并校验数据；
4. 切换读取；
5. 后续版本再收缩旧结构。

不要把自动回滚 DDL 当作唯一恢复策略；数据库破坏性变更通常需要备份恢复或向前修复。

## 5. 构建与启动

```bash
pnpm build
pnpm --filter @jingwei/server start
```

构建完成后要检查：

- 生成的模块清单与目标 Edition 一致；
- Server 和 Web 都能解析生成入口；
- 未选模块没有进入 bundle；
- 静态资源路径正确；
- 生产 server 可以在没有 TypeScript 源加载器的环境启动。

## 6. 健康检查与优雅停机

`GET /health` 用作存活/基础就绪探针。探针超时应短，失败阈值应允许短暂启动抖动但能及时摘除异常实例。

进程收到终止信号后应：

1. 停止接收新请求；
2. 等待有界时间内的在途请求；
3. 停止 outbox 轮询并等待当前分发完成；
4. 关闭数据库连接池；
5. 以可观测状态退出。

强制终止可能留下未发布 outbox，但不应造成业务数据与事件记录不一致；下一实例会重试未发布事件。

## 7. 日志、审计和告警

### 日志

运行日志使用结构化字段，至少包含时间、级别、消息、requestId 和相关模块。错误日志保留内部 cause/stack，但外部响应不返回这些内容。

### 审计

审计记录面向合规和业务追溯，不能因为降低日志级别而消失。需要独立的保留、查询与访问控制策略。

### Outbox 指标

建议监控：

- 未发布事件数量和最老事件年龄；
- 每分钟成功/失败数；
- 连续重试次数；
- 分发延迟；
- worker 是否仍有心跳。

告警应优先基于用户影响和积压年龄，而不是单次瞬时失败。

## 8. 备份与恢复

- 定期执行 PostgreSQL 逻辑或物理备份；
- 备份加密并限制访问；
- 在隔离环境定期演练恢复；
- 记录恢复点目标和恢复时间目标；
- 恢复后验证迁移表、租户目录、会话策略、审计与 outbox 状态；
- 不把应用构建产物当作数据库备份。

## 9. 安全运维

- 所有外部流量使用 TLS；
- 数据库不直接暴露公网；
- Secret 不进入 Git、镜像层、日志或错误响应；
- Cookie 的 Domain/Path/SameSite/Secure 与实际部署拓扑一致；
- Origin 白名单使用规范化的完整来源；
- 默认管理员密码必须在首次部署前替换；
- 依赖和基础镜像定期更新并经过回归测试；
- 数据导出、审计查询和运维后台执行最小权限。

## 10. 常见故障

### Server 启动即退出

检查配置验证错误、数据库连通性、Edition 生成物是否存在，以及生产 bundle 是否包含工作区运行时依赖。

### 页面存在但菜单不显示

依次检查当前发布 versionId、节点 status 及祖先、type 是否为隐藏 PAGE、Edition/页面绑定、accessMode 与当前活跃角色的 navigation code grants。角色获授功能 Permission 不代表同时获得同名导航 code。

### bootstrap 返回 503

NAVIGATION_NOT_PUBLISHED 表示租户还没有发布版本，本地先迁移并运行 seed:navigation。NAVIGATION_CONFIGURATION_INVALID 表示已发布快照与当前 Edition/校验规则不兼容；使用管理 API 修正草稿再发布。静态恢复层只保留恢复入口，不自动替代数据库配置。

### Navigation 升级与回退

schemaVersion 2 与统一节点迁移要求前后端一起部署；迁移前备份。配置发布使用 expectedPublishedVersionId 防止覆盖他人发布。回滚选择曾发布且仍与当前 Edition 兼容的快照，不撤销角色授权或业务数据。普通用户下一次请求读取新配置；当前不推送到已打开的浏览器。

### 登录成功后立即变成未登录

检查浏览器是否接受三个 Cookie、Secure 与协议是否匹配、SameSite/Domain/Path、反向代理头、系统时间、Access 有效期和 Token Family 摘要查询。

### 正确密码仍提示认证失败

检查用户与租户状态、`iam.user_credential.locked_until`、应用与数据库系统时间。账号锁定不会通过 API 单独暴露；默认到期自动允许重试，成功后清零 `failed_attempts`。公网入口仍应配置按 IP/设备的边缘限流，账号锁定不能替代网关级抗爆破和告警。

### 修改请求返回 403

检查 Origin 白名单、CSRF Cookie、CSRF 请求头、Access/Refresh Cookie 和代理是否改写相关头。

### Outbox 持续积压

检查 dispatcher 下游、数据库锁/连接、worker 日志与重试次数。不要直接把事件标成成功；修复根因后让幂等分发继续。

### 迁移集合不符合预期

确认构建与迁移使用同一个 Edition，检查 manifest dependency 是否完整，并查看 Edition Builder 生成的模块顺序。

## 11. 发布检查表

- 锁定并审计依赖；
- `pnpm check`、build、迁移测试和 E2E 全部通过；
- Edition 及物理裁剪结果已复核；
- 配置和 Secret 已在目标环境验证；
- 数据库备份和恢复方案可用；
- 迁移先于依赖新结构的进程；
- 健康检查、日志、指标和告警已接入；
- 有明确回退版本或向前修复方案；
- 发布后验证登录、导航和一个核心读写路径。
