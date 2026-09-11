import type { Component } from 'vue'

import type { LayoutMode, LayoutPreferences } from '../../stores/layout.js'
import GlobalBreadcrumb from './modules/global-header/GlobalBreadcrumb.vue'
import HeaderGlobalMenu from './modules/global-menu/HeaderGlobalMenu.vue'
import HeaderMenuMountPoint from './modules/global-menu/HeaderMenuMountPoint.vue'
import SiderGlobalMenu from './modules/global-menu/SiderGlobalMenu.vue'

export interface LayoutModeContext {
  readonly preferences: LayoutPreferences
  readonly isMobile: boolean
}

export interface LayoutModeDefinition {
  readonly menuComponent: Component
  readonly headerContextComponent: Component
  readonly sidebarVisible: boolean
  readonly orientation: (context: LayoutModeContext) => 'horizontal' | 'vertical'
  readonly showHeaderBrand: (context: LayoutModeContext) => boolean
  readonly showSiderBrand: (context: LayoutModeContext) => boolean
}

const layoutModeRegistry = {
  left: {
    menuComponent: SiderGlobalMenu,
    headerContextComponent: GlobalBreadcrumb,
    sidebarVisible: true,
    orientation: ({ preferences, isMobile }) =>
      isMobile || preferences.brandPlacement === 'header' ? 'vertical' : 'horizontal',
    showHeaderBrand: ({ preferences, isMobile }) =>
      isMobile || preferences.brandPlacement === 'header',
    showSiderBrand: ({ preferences, isMobile }) =>
      !isMobile && preferences.brandPlacement === 'sider',
  },
  top: {
    menuComponent: HeaderGlobalMenu,
    headerContextComponent: HeaderMenuMountPoint,
    sidebarVisible: false,
    orientation: () => 'vertical',
    showHeaderBrand: () => true,
    showSiderBrand: () => false,
  },
} satisfies Record<LayoutMode, LayoutModeDefinition>

export function getLayoutModeDefinition(mode: LayoutMode): LayoutModeDefinition {
  return layoutModeRegistry[mode]
}
