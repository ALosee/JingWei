import { defineModule } from '@jingwei/module-sdk'

export const manifest = defineModule({
  id: 'organization',
  name: '组织与岗位',
  category: 'foundation',
  dependencies: ['iam'],
  optionalDependencies: [],
  capabilities: [{ id: 'organization.core', name: '组织与岗位基础' }],
  permissions: [
    { code: 'organization.view', name: '查看组织', supportsDataScope: false },
    { code: 'organization.manage', name: '管理组织', supportsDataScope: false },
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
})
