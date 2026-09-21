import { createRouter, createWebHistory } from 'vue-router'

import {
  PlatformLogin,
  PlatformShell,
  PlatformTenantDetail,
  PlatformTenants,
} from '@jingwei/control-plane/web'

/** Platform routes are static and never depend on a tenant navigation projection. */
export function createPlatformRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: '/platform/login',
        name: 'platform-login',
        component: PlatformLogin,
        meta: { title: '平台登录' },
      },
      {
        path: '/platform',
        component: PlatformShell,
        children: [
          { path: '', redirect: '/platform/tenants' },
          {
            path: 'tenants',
            name: 'platform-tenants',
            component: PlatformTenants,
            meta: { title: '租户管理' },
          },
          {
            path: 'tenants/:tenantId',
            name: 'platform-tenant-detail',
            component: PlatformTenantDetail,
            meta: { title: '租户详情' },
          },
        ],
      },
      { path: '/platform/:pathMatch(.*)*', redirect: '/platform/tenants' },
    ],
  })
}
