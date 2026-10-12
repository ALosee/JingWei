import type { Router } from 'vue-router'

import type { NavigationResponse } from '@jingwei/module-navigation/shared'
import type { PageTabsOptionData } from '@jingwei/ui'

import { resolveSafeReturnPath } from '../../navigation/workspace-targets.js'

export interface WorkspaceTabLocation {
  navigationCode: string
  routeKey: string
  fullPath: string
}

export interface SavedWorkspaceTab extends WorkspaceTabLocation {
  pinned: boolean
}

export function workspaceTabSessionKey(tenantId: string, userId: string): string {
  return `jingwei:workspace-tabs:v1:${tenantId}:${userId}`
}

/** Storage is optional: blocked access, quota errors and malformed snapshots never block the shell. */
export function readWorkspaceTabSession(key: string | null): SavedWorkspaceTab[] {
  if (key === null || typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(key)
    if (raw === null) return []
    const snapshot: unknown = JSON.parse(raw)
    if (!isRecord(snapshot) || snapshot.version !== 1 || !Array.isArray(snapshot.tabs)) return []
    const candidates: unknown[] = snapshot.tabs
    return candidates.filter(isSavedTab)
  } catch {
    return []
  }
}

export function writeWorkspaceTabSession(key: string | null, tabs: SavedWorkspaceTab[]): void {
  if (key === null || typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ version: 1, tabs }))
  } catch {
    // The in-memory workspace remains usable when browser storage is unavailable.
  }
}

/** Derive labels and eligibility from the currently authorized projection and installed routes. */
export function resolveWorkspaceTab(
  fullPath: string,
  router: Router,
  navigation: NavigationResponse | null,
): {
  item: PageTabsOptionData
  location: WorkspaceTabLocation
} | null {
  if (navigation === null || resolveSafeReturnPath(fullPath) !== fullPath) return null
  try {
    const route = router.resolve(fullPath)
    const { navigationCode, routeKey } = route.meta
    if (typeof navigationCode !== 'string' || typeof routeKey !== 'string') return null
    const node = navigation.nodes.find(
      (entry) => entry.code === navigationCode && entry.routeKey === routeKey,
    )
    if (
      node?.status !== 'ENABLED' ||
      node.layout !== 'base' ||
      (node.type !== 'MENU' && node.type !== 'PAGE') ||
      !route.matched.some(
        (record) =>
          record.path === node.path &&
          record.meta.navigationCode === navigationCode &&
          record.meta.routeKey === routeKey,
      )
    )
      return null
    return {
      item: { value: route.path, label: node.name, hidePinnedIcon: true },
      location: { navigationCode, routeKey, fullPath: route.fullPath },
    }
  } catch {
    return null
  }
}

function isSavedTab(value: unknown): value is SavedWorkspaceTab {
  return (
    isRecord(value) &&
    typeof value.fullPath === 'string' &&
    typeof value.navigationCode === 'string' &&
    typeof value.routeKey === 'string' &&
    typeof value.pinned === 'boolean'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
