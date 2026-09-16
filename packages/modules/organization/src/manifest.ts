import { defineModule } from '@jingwei/module-sdk'

export const manifest = defineModule({
  id: 'organization',
  name: '组织与岗位',
  category: 'foundation',
  dependencies: ['iam'],
  optionalDependencies: [],
  capabilities: [{ id: 'organization.core', name: '组织与岗位基础' }],
  dataScopeProviders: [{ id: 'organization' }],
  permissions: [
    {
      code: 'organization.view',
      name: '查看组织',
      dataScope: {
        allowedTypes: ['ALL', 'ORGANIZATION', 'ORGANIZATION_AND_DESCENDANTS', 'CUSTOM'],
        provider: 'organization',
      },
    },
    { code: 'organization.manage', name: '管理组织' },
  ],
  routeDefinitions: [
    {
      key: 'organization.units',
      page: 'OrganizationUnits',
      layout: 'base',
      allowedAccessModes: ['PERMISSION'],
      requiredCapability: 'organization.core',
      requiredPermission: 'organization.view',
    },
  ],
  navigationItems: [
    {
      code: 'organization.units',
      name: '组织架构',
      type: 'MENU',
      parentCode: 'administration',
      routeKey: 'organization.units',
      path: '/organization/units',
      accessMode: 'PERMISSION',
      sortOrder: 40,
      icon: 'lucide:network',
    },
  ],
})
