import { defineModule } from '@jingwei/module-sdk'

export const manifest = defineModule({
  id: 'iam',
  name: '身份与访问管理',
  category: 'foundation',
  dependencies: [],
  optionalDependencies: [],
  capabilities: [
    { id: 'iam.authentication', name: '身份认证' },
    { id: 'iam.authorization', name: '角色与权限' },
  ],
  permissions: [
    { code: 'iam.user.view', name: '查看用户', supportsDataScope: false },
    { code: 'iam.user.manage', name: '管理用户', supportsDataScope: false },
    { code: 'iam.role.view', name: '查看角色', supportsDataScope: false },
    { code: 'iam.role.manage', name: '管理角色', supportsDataScope: false },
  ],
  routeDefinitions: [
    {
      key: 'iam.login',
      page: 'IamLogin',
      layout: 'blank',
      allowedAccessModes: ['PUBLIC'],
      requiredCapability: 'iam.authentication',
    },
    {
      key: 'iam.account',
      page: 'IamAccount',
      layout: 'base',
      allowedAccessModes: ['AUTHENTICATED'],
      requiredCapability: 'iam.authentication',
    },
  ],
})
