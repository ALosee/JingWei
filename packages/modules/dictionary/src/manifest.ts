import { defineModule } from '@jingwei/module-sdk'

export const manifest = defineModule({
  id: 'dictionary',
  name: '数据字典',
  category: 'foundation',
  dependencies: ['iam'],
  optionalDependencies: [],
  capabilities: [{ id: 'dictionary.core', name: '租户数据字典' }],
  permissions: [
    { code: 'dictionary.view', name: '查看数据字典', supportsDataScope: false },
    { code: 'dictionary.manage', name: '管理数据字典', supportsDataScope: false },
  ],
  routeDefinitions: [
    {
      key: 'dictionary.entries',
      page: 'DictionaryEntries',
      layout: 'base',
      allowedAccessModes: ['PERMISSION'],
      requiredCapability: 'dictionary.core',
      requiredPermission: 'dictionary.view',
    },
  ],
})
