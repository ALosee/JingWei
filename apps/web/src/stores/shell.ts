import { defineStore } from 'pinia'

import type { AuthenticatedUser } from '@jingwei/module-iam/shared'
import type { NavigationResponse } from '@jingwei/module-navigation/shared'

export const useShellStore = defineStore('shell', {
  state: () => ({
    navigation: null as NavigationResponse | null,
    currentUser: null as AuthenticatedUser | null,
    bootstrapError: null as string | null,
  }),
})
