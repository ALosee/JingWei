import { navigationTarget, type NavigationResponse } from '@jingwei/module-navigation/shared'

/** Pure startup routing policy; never replace a recognized deep link's actual params/query/hash. */
export function selectInitialLocation(input: {
  readonly initialLocation: string
  readonly navigation: NavigationResponse
  readonly authenticated: boolean
  readonly recognized: boolean
}): string {
  const { initialLocation, navigation, authenticated, recognized } = input
  if (initialLocation !== '/' && recognized) return initialLocation
  if (initialLocation !== '/' && authenticated) return '/__recovery'
  const authEntry = navigation.nodes.find((node) => node.code === navigation.authEntryCode)
  const home =
    navigation.nodes.find((node) => node.code === navigation.homeCode) ??
    navigation.nodes.find((node) => node.type === 'MENU' && node.accessMode !== 'PUBLIC')
  const fallback = authenticated ? home : authEntry
  return fallback === undefined ? '/__recovery' : (navigationTarget(fallback) ?? '/__recovery')
}
