import { z } from 'zod'

export {
  brandLogoSvgElements,
  brandLogoSvgNamespace,
  brandLogoSvgProfileVersion,
  hasValidBrandLogoAspectRatio,
  isBrandLogoSvgElement,
  maximumBrandAssetBytes,
  maximumBrandLogoSvgAttributesPerElement,
  maximumBrandLogoSvgDepth,
  maximumBrandLogoSvgElements,
  maximumBrandLogoAspectRatio,
  minimumBrandLogoAspectRatio,
  parseBrandLogoSvgViewBox,
  validateBrandLogoSvgAttribute,
  type BrandLogoSvgElement,
  type BrandLogoSvgViewBox,
} from './brand-logo-svg-profile.js'

export const brandTitleModes = ['SYSTEM_ONLY', 'PAGE_AND_SYSTEM'] as const
export const brandAssetPurposes = ['LOGO', 'MARK', 'FAVICON'] as const
export const brandAssetContentTypes = ['image/png', 'image/svg+xml'] as const
export const brandAssetValidationProfiles = ['PNG_V1', 'BRAND_LOGO_SVG_V1'] as const
export const horizontalBrandModes = ['PLATFORM_WORDMARK', 'SHORT_NAME', 'CUSTOM_LOGO'] as const
export const logoColorModes = ['ORIGINAL', 'FOLLOW_THEME'] as const

const brandConfigurationShape = {
  systemName: z.string().trim().min(1).max(80),
  shortName: z.string().trim().min(1).max(24),
  loginTitle: z.string().trim().min(1).max(100),
  loginTagline: z.string().trim().max(240),
  titleMode: z.enum(brandTitleModes),
  horizontalBrandMode: z.enum(horizontalBrandModes),
  logoColorMode: z.enum(logoColorModes),
  logoAssetId: z.uuid().nullable(),
  markAssetId: z.uuid().nullable(),
  faviconAssetId: z.uuid().nullable(),
} as const

function requireCustomLogo(
  value: { horizontalBrandMode: HorizontalBrandMode; logoAssetId: string | null },
  context: z.core.$RefinementCtx,
): void {
  if (value.horizontalBrandMode !== 'CUSTOM_LOGO' || value.logoAssetId !== null) return
  context.addIssue({
    code: 'custom',
    path: ['logoAssetId'],
    message: '选择自定义 Logo 时必须上传横向 Logo',
    input: value,
  })
}

export const brandAssetSchema = z
  .object({
    id: z.uuid(),
    purpose: z.enum(brandAssetPurposes),
    contentType: z.enum(brandAssetContentTypes),
    validationProfile: z.enum(brandAssetValidationProfiles),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    byteSize: z.number().int().positive(),
    url: z.string().startsWith('/api/v1/branding/assets/'),
  })
  .strict()
  .meta({ id: 'BrandAsset' })

export const brandConfigurationSchema = z
  .object(brandConfigurationShape)
  .strict()
  .superRefine(requireCustomLogo)
  .meta({ id: 'BrandConfiguration' })

export const brandVersionSchema = z
  .object({
    ...brandConfigurationShape,
    id: z.uuid(),
    revision: z.number().int().positive(),
    editRevision: z.number().int().nonnegative(),
    status: z.enum(['DRAFT', 'PUBLISHED']),
    publishedAt: z.string().nullable(),
    logoAsset: brandAssetSchema.nullable(),
    markAsset: brandAssetSchema.nullable(),
    faviconAsset: brandAssetSchema.nullable(),
  })
  .strict()
  .superRefine(requireCustomLogo)
  .meta({ id: 'BrandVersion' })

export const brandVersionSummarySchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().positive(),
    editRevision: z.number().int().nonnegative(),
    status: z.enum(['DRAFT', 'PUBLISHED']),
    publishedAt: z.string().nullable(),
  })
  .strict()
  .meta({ id: 'BrandVersionSummary' })

export const brandAdminSchema = z
  .object({
    publishedVersionId: z.uuid().nullable(),
    versions: z.array(brandVersionSummarySchema),
  })
  .strict()
  .meta({ id: 'BrandAdminOverview' })

export const brandDraftSourceSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('PLATFORM_DEFAULT') }).strict(),
    z.object({ kind: z.literal('VERSION'), versionId: z.uuid() }).strict(),
  ])
  .meta({ id: 'BrandDraftSource' })

export const createBrandDraftSchema = z
  .object({ source: brandDraftSourceSchema })
  .strict()
  .meta({ id: 'BrandCreateDraftInput' })

export const saveBrandDraftSchema = z
  .object({
    ...brandConfigurationShape,
    expectedEditRevision: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine(requireCustomLogo)
  .meta({ id: 'BrandSaveDraftInput' })

export const publishBrandSchema = z
  .object({
    expectedEditRevision: z.number().int().nonnegative(),
    expectedPublishedVersionId: z.uuid().nullable(),
  })
  .strict()
  .meta({ id: 'BrandPublishInput' })

export const restoreDefaultBrandSchema = z
  .object({ expectedPublishedVersionId: z.uuid() })
  .strict()
  .meta({ id: 'BrandRestoreDefaultInput' })

export const effectiveBrandSchema = z
  .object({
    schemaVersion: z.literal(2),
    source: z.enum(['DEFAULT', 'PUBLISHED']),
    publishedRevision: z.number().int().positive().nullable(),
    systemName: z.string(),
    shortName: z.string(),
    loginTitle: z.string(),
    loginTagline: z.string(),
    titleMode: z.enum(brandTitleModes),
    horizontalBrandMode: z.enum(horizontalBrandModes),
    logoColorMode: z.enum(logoColorModes),
    logoUrl: z.string().nullable(),
    logoContentType: z.enum(brandAssetContentTypes).nullable(),
    markUrl: z.string().nullable(),
    faviconUrl: z.string().nullable(),
  })
  .strict()
  .meta({ id: 'EffectiveBrand' })

export const defaultBrandConfiguration: BrandConfiguration = Object.freeze({
  systemName: '经纬企业平台',
  shortName: '经纬',
  loginTitle: '经纬企业平台',
  loginTagline: '让组织、权限与业务边界保持清晰，让每一次协作都有迹可循。',
  titleMode: 'PAGE_AND_SYSTEM',
  horizontalBrandMode: 'PLATFORM_WORDMARK',
  logoColorMode: 'FOLLOW_THEME',
  logoAssetId: null,
  markAssetId: null,
  faviconAssetId: null,
})

export const defaultEffectiveBrand: EffectiveBrand = Object.freeze({
  schemaVersion: 2,
  source: 'DEFAULT',
  publishedRevision: null,
  systemName: defaultBrandConfiguration.systemName,
  shortName: defaultBrandConfiguration.shortName,
  loginTitle: defaultBrandConfiguration.loginTitle,
  loginTagline: defaultBrandConfiguration.loginTagline,
  titleMode: defaultBrandConfiguration.titleMode,
  horizontalBrandMode: defaultBrandConfiguration.horizontalBrandMode,
  logoColorMode: defaultBrandConfiguration.logoColorMode,
  logoUrl: null,
  logoContentType: null,
  markUrl: null,
  faviconUrl: null,
})

export function brandAssetUrl(id: string): string {
  return `/api/v1/branding/assets/${encodeURIComponent(id)}`
}

export function resolveHorizontalBrandMode(
  mode: HorizontalBrandMode,
  logoUrl: string | null | undefined,
): Exclude<HorizontalBrandMode, 'CUSTOM_LOGO'> | 'CUSTOM_LOGO' {
  return mode === 'CUSTOM_LOGO' && !logoUrl ? 'SHORT_NAME' : mode
}

export type BrandAssetPurpose = (typeof brandAssetPurposes)[number]
export type BrandAssetContentType = (typeof brandAssetContentTypes)[number]
export type BrandAssetValidationProfile = (typeof brandAssetValidationProfiles)[number]
export type HorizontalBrandMode = (typeof horizontalBrandModes)[number]
export type LogoColorMode = (typeof logoColorModes)[number]
export type BrandAsset = z.infer<typeof brandAssetSchema>
export type BrandConfiguration = z.infer<typeof brandConfigurationSchema>
export type BrandVersion = z.infer<typeof brandVersionSchema>
export type BrandVersionSummary = z.infer<typeof brandVersionSummarySchema>
export type BrandAdmin = z.infer<typeof brandAdminSchema>
export type BrandDraftSource = z.infer<typeof brandDraftSourceSchema>
export type CreateBrandDraft = z.infer<typeof createBrandDraftSchema>
export type SaveBrandDraft = z.infer<typeof saveBrandDraftSchema>
export type PublishBrand = z.infer<typeof publishBrandSchema>
export type RestoreDefaultBrand = z.infer<typeof restoreDefaultBrandSchema>
export type EffectiveBrand = z.infer<typeof effectiveBrandSchema>
