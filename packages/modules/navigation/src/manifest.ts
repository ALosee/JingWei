import { defineModule } from '@jingwei/module-sdk'

export const manifest = defineModule({
  id: 'navigation',
  name: '动态导航',
  category: 'foundation',
  dependencies: ['iam'],
  optionalDependencies: [],
  capabilities: [{ id: 'navigation.core', name: '动态导航编排' }],
  permissions: [
    { code: 'navigation.view', name: '查看导航配置', supportsDataScope: false },
    { code: 'navigation.manage', name: '管理导航配置', supportsDataScope: false },
    { code: 'navigation.publish', name: '发布导航配置', supportsDataScope: false },
  ],
  routeDefinitions: [
    {
      key: 'navigation.manage',
      page: 'NavigationManage',
      layout: 'base',
      allowedAccessModes: ['PERMISSION'],
      requiredCapability: 'navigation.core',
      requiredPermission: 'navigation.view',
    },
  ],
})
