import { createPinia } from 'pinia'
import { createApp, readonly } from 'vue'

import { defaultEffectiveBrand, type EffectiveBrand } from '@jingwei/module-branding/shared'
import {
  activeBrand,
  DefaultBrandMark,
  DefaultBrandWordmark,
  loadEffectiveBrand,
  setActiveBrand,
} from '@jingwei/module-branding/web'
import { getSessionStatus } from '@jingwei/module-iam/client'
import {
  authBrandPresentationKey,
  authPlatformMarkComponentKey,
  authPlatformWordmarkComponentKey,
  authTenantBrandSelectorKey,
} from '@jingwei/module-iam/public/web'
import { currentTenantLoginHint } from '@jingwei/module-iam/web'
import {
  getAuthenticatedNavigation,
  getNavigationBootstrap,
} from '@jingwei/module-navigation/client'

import { applyDocumentBrand } from '../branding/document-brand.js'
import { installSessionExpiryRedirect } from '../composables/use-session-expiry.js'
import { installGeneratedWebIntegrations } from '../generated/modules.js'
import { initializeNavigation } from '../navigation/initialize-navigation.js'
import { loadTenantNavigationBootstrap } from '../navigation/tenant-bootstrap.js'
import { installDynamicRoutes } from '../router/dynamic-routes.js'
import { createApplicationRouter } from '../router/index.js'
import { useAppearanceStore } from '../stores/appearance.js'
import { useLayoutStore } from '../stores/layout.js'
import { useShellStore } from '../stores/shell.js'
import TenantApp from '../TenantApp.vue'

/** Composition root for tenant workspaces. */
export async function startTenantWebApplication(): Promise<void> {
  const initialLocation = window.location.pathname + window.location.search + window.location.hash
  const app = createApp(TenantApp)
  app.provide(authBrandPresentationKey, readonly(activeBrand))
  app.provide(authPlatformMarkComponentKey, DefaultBrandMark)
  app.provide(authPlatformWordmarkComponentKey, DefaultBrandWordmark)
  installGeneratedWebIntegrations(app)
  const pinia = createPinia()
  const router = createApplicationRouter()
  const appearance = useAppearanceStore(pinia)
  const layout = useLayoutStore(pinia)
  const shell = useShellStore(pinia)
  const tenantLoginHint = currentTenantLoginHint()
  let brandSelection = 0
  const applyBrand = (brand: EffectiveBrand): void => {
    setActiveBrand(brand)
    layout.setTenantDefaults(brand.workspaceDefaults)
    const title = router.currentRoute.value.meta.title
    applyDocumentBrand(brand, typeof title === 'string' ? title : undefined)
  }
  app.provide(authTenantBrandSelectorKey, {
    async select(tenantCode) {
      const selection = ++brandSelection
      const brand = await loadEffectiveBrand(tenantCode).catch(() => defaultEffectiveBrand)
      if (selection === brandSelection) applyBrand(brand)
    },
  })
  app.use(pinia)
  app.use(router)
  installSessionExpiryRedirect()
  await initializeNavigation(initialLocation, {
    loadBrand: () => loadEffectiveBrand(tenantLoginHint),
    applyBrand,
    loadBootstrap: () => loadTenantNavigationBootstrap(tenantLoginHint, getNavigationBootstrap),
    loadSession: getSessionStatus,
    loadAuthenticated: getAuthenticatedNavigation,
    install: (navigation) => installDynamicRoutes(router, navigation),
    recognizes: (location) => router.resolve(location).name !== 'not-found-recovery',
    replace: (location) => router.replace(location),
    shell,
  })
  const user = shell.currentUser
  layout.setUserScope(user?.tenantId ?? null, user?.id ?? null)
  appearance.setUserScope(user?.tenantId ?? null, user?.id ?? null)
  router.afterEach((route) => {
    const title = typeof route.meta.title === 'string' ? route.meta.title : undefined
    applyDocumentBrand(activeBrand.value, title)
  })
  await router.isReady()
  app.mount('#app')
}
