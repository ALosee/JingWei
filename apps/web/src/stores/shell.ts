import { defineStore } from 'pinia'
import type { NavigationResponse } from '@jingwei/module-navigation/shared'

export const useShellStore = defineStore('shell', {
  state: () => ({
    navigation: null as NavigationResponse | null,
    bootstrapError: null as string | null,
  }),
})
