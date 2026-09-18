import { inject, readonly, shallowRef, type Component, type InjectionKey, type Ref } from 'vue'

export interface AuthBrandPresentation {
  readonly systemName: string
  readonly shortName: string
  readonly loginTitle: string
  readonly loginTagline: string
  readonly logoUrl: string | null
  readonly markUrl: string | null
  readonly horizontalBrandMode: 'PLATFORM_WORDMARK' | 'SHORT_NAME' | 'CUSTOM_LOGO'
  readonly logoColorMode: 'ORIGINAL' | 'FOLLOW_THEME'
}

/** Matches branding module's platform default compact name. */
export const defaultAuthShortName = '经纬'

const fallback = readonly(
  shallowRef<AuthBrandPresentation>({
    systemName: '经纬企业平台',
    shortName: defaultAuthShortName,
    loginTitle: '经纬企业平台',
    loginTagline: '让组织、权限与业务边界保持清晰，让每一次协作都有迹可循。',
    logoUrl: null,
    markUrl: null,
    horizontalBrandMode: 'PLATFORM_WORDMARK',
    logoColorMode: 'FOLLOW_THEME',
  }),
)

export const authBrandPresentationKey: InjectionKey<Readonly<Ref<AuthBrandPresentation>>> = Symbol(
  'iam-auth-brand-presentation',
)
export const authPlatformWordmarkComponentKey: InjectionKey<Component> = Symbol(
  'iam-auth-platform-wordmark-component',
)

export function useAuthBrandPresentation(): Readonly<Ref<AuthBrandPresentation>> {
  return inject(authBrandPresentationKey, fallback)
}
