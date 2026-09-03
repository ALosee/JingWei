import { createRouter, createWebHistory } from 'vue-router'

import BootstrapPage from '../recovery/BootstrapPage.vue'
import RecoveryPage from '../recovery/RecoveryPage.vue'

/** Create a fresh router only when the application is started, never as an import side effect. */
export function createApplicationRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'bootstrap', component: BootstrapPage },
      { path: '/__recovery', name: 'recovery', component: RecoveryPage },
      { path: '/:pathMatch(.*)*', name: 'not-found-recovery', component: RecoveryPage },
    ],
  })
}
