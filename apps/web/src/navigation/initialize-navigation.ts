import type { NavigationResponse } from '@jingwei/module-navigation/shared'
import { selectInitialLocation } from './initial-location.js'

/** Narrow ports keep startup orchestration independent of Vue, Pinia, HTTP and browser globals. */
export interface NavigationStartupDependencies {
  loadBootstrap: () => Promise<NavigationResponse>
  loadSession: () => Promise<{ authenticated: boolean }>
  loadAuthenticated: () => Promise<NavigationResponse | null>
  install: (navigation: NavigationResponse) => void
  recognizes: (location: string) => boolean
  replace: (location: string) => Promise<unknown>
  readonly shell: { navigation: NavigationResponse | null; bootstrapError: string | null }
}

/** Public bootstrap precedes optional user navigation. A 401 race falls back to public navigation. */
export async function initializeNavigation(initialLocation: string, dependencies: NavigationStartupDependencies): Promise<void> {
  const { shell } = dependencies
  try {
    const bootstrap = await dependencies.loadBootstrap()
    dependencies.install(bootstrap)
    const session = await dependencies.loadSession()
    const authenticated = session.authenticated ? await dependencies.loadAuthenticated() : null
    const navigation = authenticated ?? bootstrap
    dependencies.install(navigation)
    shell.navigation = navigation
    await dependencies.replace(selectInitialLocation({
      initialLocation, navigation, authenticated: authenticated !== null,
      recognized: dependencies.recognizes(initialLocation),
    }))
  } catch (error) {
    shell.bootstrapError = error instanceof Error ? error.message : 'Navigation bootstrap failed'
    await dependencies.replace('/__recovery')
  }
}
