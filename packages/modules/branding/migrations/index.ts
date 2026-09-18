import * as brandingFoundation from './20260917090000_branding_foundation.js'
import * as brandingAllowHistoryVersionDelete from './20260918120000_branding_allow_history_version_delete.js'
import * as brandingRestorePublishedImmutable from './20260918130000_branding_restore_published_immutable.js'
import * as brandingSvgAndHorizontalDisplay from './20260918140000_branding_svg_and_horizontal_display.js'

export const migrations = {
  '20260917090000_branding_foundation': brandingFoundation,
  '20260918120000_branding_allow_history_version_delete': brandingAllowHistoryVersionDelete,
  '20260918130000_branding_restore_published_immutable': brandingRestorePublishedImmutable,
  '20260918140000_branding_svg_and_horizontal_display': brandingSvgAndHorizontalDisplay,
} as const
