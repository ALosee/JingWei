# Platform Management

平台控制面的灾备工具。目前只提供一次性的首位平台管理员初始化；日常租户管理应通过
`/platform` 页面完成，而不是依赖 CLI。

```bash
PLATFORM_OPERATOR_PASSWORD='至少十二位的密码' \
  pnpm platform:bootstrap --login platform-admin --name 平台管理员
```

命令仅在尚无平台管理员时成功。密码只从环境变量读取，不应出现在命令参数或 shell 历史中。

本地使用仓库 `.env.test` 时，显式加载该文件：

```bash
PLATFORM_OPERATOR_PASSWORD='至少十二位的密码' \
  node --env-file=.env.test --import tsx tooling/platform-management/src/cli.ts \
  --login platform-admin --name 平台管理员
```
