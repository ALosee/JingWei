import { createPinia } from 'pinia'
import { createApp } from 'vue'

import 'virtual:uno.css'
import '@jingwei/ui/styles.css'
import { getSessionStatus } from '@jingwei/module-iam/client'
import {
  getAuthenticatedNavigation,
  getNavigationBootstrap,
} from '@jingwei/module-navigation/client'

import App from '../App.vue'
import { initializeNavigation } from '../navigation/initialize-navigation.js'
import { installDynamicRoutes } from '../router/dynamic-routes.js'
import { createApplicationRouter } from '../router/index.js'
import { useShellStore } from '../stores/shell.js'

/** Composition root: choose concrete adapters, initialize the shell, then mount once. */
export async function startWebApplication(): Promise<void> {
  const initialLocation = window.location.pathname + window.location.search + window.location.hash
  const app = createApp(App)
  const pinia = createPinia()
  const router = createApplicationRouter()
  app.use(pinia)
  app.use(router)
  await initializeNavigation(initialLocation, {
    loadBootstrap: getNavigationBootstrap,
    loadSession: getSessionStatus,
    loadAuthenticated: getAuthenticatedNavigation,
    install: (navigation) => installDynamicRoutes(router, navigation),
    recognizes: (location) => router.resolve(location).name !== 'not-found-recovery',
    replace: (location) => router.replace(location),
    shell: useShellStore(pinia),
  })
  await router.isReady()
  app.mount('#app')
}
