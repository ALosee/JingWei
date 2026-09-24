import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { initializePlatformSession } from '@jingwei/control-plane/web'

import PlatformApp from '../PlatformApp.vue'
import { createPlatformRouter } from '../router/platform-router.js'

/** Composition root for the platform control plane. */
export async function startPlatformWebApplication(): Promise<void> {
  const initialLocation = window.location.pathname + window.location.search + window.location.hash
  const authenticated = await initializePlatformSession()

  const app = createApp(PlatformApp)
  const router = createPlatformRouter()
  app.use(createPinia())
  app.use(router)

  if (authenticated && window.location.pathname === '/platform/login') {
    await router.replace('/platform/tenants')
  } else if (!authenticated && window.location.pathname !== '/platform/login') {
    await router.replace(`/platform/login?redirect=${encodeURIComponent(initialLocation)}`)
  }

  router.afterEach((route) => {
    document.title =
      typeof route.meta.title === 'string' ? `${route.meta.title} · 经纬平台管理` : '经纬平台管理'
  })
  await router.isReady()
  app.mount('#app')
}
