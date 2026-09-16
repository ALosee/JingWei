import { defineModule } from '@jingwei/module-sdk'

export const manifest = defineModule({
  id: 'dictionary',
  name: '数据字典',
  category: 'foundation',
  dependencies: ['iam'],
  optionalDependencies: [],
  capabilities: [{ id: 'dictionary.core', name: '租户数据字典' }],
  permissions: [
    { code: 'dictionary.view', name: '查看数据字典' },
    { code: 'dictionary.manage', name: '管理数据字典' },
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
  navigationItems: [
    {
      code: 'dictionary.entries',
      name: '数据字典',
      type: 'MENU',
      parentCode: 'administration',
      routeKey: 'dictionary.entries',
      path: '/dictionary/entries',
      accessMode: 'PERMISSION',
      sortOrder: 50,
      icon: 'lucide:book-open',
    },
  ],
})
