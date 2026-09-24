import * as brandingFoundation from './20260917090000_branding_foundation.js'
import * as brandingAllowHistoryVersionDelete from './20260918120000_branding_allow_history_version_delete.js'
import * as brandingRestorePublishedImmutable from './20260918130000_branding_restore_published_immutable.js'
import * as brandingSvgAndHorizontalDisplay from './20260918140000_branding_svg_and_horizontal_display.js'
import * as brandingMarkSvgFaviconIco from './20260918150000_branding_mark_svg_favicon_ico.js'
import * as brandingAssetValidationV2 from './20260919130000_branding_asset_validation_v2.js'
import * as brandingTenantPresentation from './20260922100000_branding_tenant_presentation.js'
import * as brandingSemanticTheme from './20260922110000_branding_semantic_theme.js'

export const migrations = {
  '20260917090000_branding_foundation': brandingFoundation,
  '20260918120000_branding_allow_history_version_delete': brandingAllowHistoryVersionDelete,
  '20260918130000_branding_restore_published_immutable': brandingRestorePublishedImmutable,
  '20260918140000_branding_svg_and_horizontal_display': brandingSvgAndHorizontalDisplay,
  '20260918150000_branding_mark_svg_favicon_ico': brandingMarkSvgFaviconIco,
  '20260919130000_branding_asset_validation_v2': brandingAssetValidationV2,
  '20260922100000_branding_tenant_presentation': brandingTenantPresentation,
  '20260922110000_branding_semantic_theme': brandingSemanticTheme,
} as const
