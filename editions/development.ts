import { defineEdition } from '@jingwei/module-sdk'

export default defineEdition({
  id: 'development',
  modules: {
    iam: true,
    organization: true,
    navigation: true,
    dictionary: true,
  },
})
