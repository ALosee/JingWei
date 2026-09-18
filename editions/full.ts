import { defineEdition } from '@jingwei/module-sdk'

export default defineEdition({
  id: 'full',
  modules: {
    branding: true,
    iam: true,
    organization: true,
    navigation: true,
    dictionary: true,
  },
  navigation: {
    authEntryCode: 'iam.login',
    homeCode: 'iam.account',
    containers: [
      {
        code: 'workspace',
        name: '工作区',
        type: 'GROUP',
        parentCode: null,
        sortOrder: 0,
      },
      {
        code: 'administration',
        name: '系统管理',
        type: 'DIRECTORY',
        parentCode: 'workspace',
        sortOrder: 20,
        icon: 'lucide:settings',
      },
    ],
  },
})
