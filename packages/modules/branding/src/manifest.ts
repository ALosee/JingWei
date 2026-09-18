import { defineModule } from '@jingwei/module-sdk'

export const manifest = defineModule({
  id: 'branding',
  name: '租户品牌',
  category: 'foundation',
  dependencies: ['iam'],
  optionalDependencies: [],
  capabilities: [{ id: 'branding.core', name: '租户品牌定制' }],
  permissions: [
    { code: 'branding.view', name: '查看品牌配置' },
    { code: 'branding.manage', name: '管理品牌草稿' },
    { code: 'branding.publish', name: '发布和回滚品牌' },
  ],
  routeDefinitions: [
    {
      key: 'branding.manage',
      page: 'BrandingManage',
      layout: 'base',
      allowedAccessModes: ['PERMISSION'],
      requiredCapability: 'branding.core',
      requiredPermission: 'branding.view',
    },
  ],
  navigationItems: [
    {
      code: 'branding.manage',
      name: '品牌定制',
      type: 'MENU',
      parentCode: 'administration',
      routeKey: 'branding.manage',
      path: '/branding/manage',
      accessMode: 'PERMISSION',
      sortOrder: 35,
      icon: 'lucide:palette',
    },
  ],
})
