import * as navigationFoundation from './20260901040100_navigation_foundation.js'
import * as navigationConfiguration from './20260902000100_navigation_configuration.js'

export const migrations = {
  '20260901040100_navigation_foundation': navigationFoundation,
  '20260902000100_navigation_configuration': navigationConfiguration,
} as const
