import type { EffectiveBrand } from '@jingwei/module-branding/shared'
import { platformDefaultFavicon } from '@jingwei/module-branding/web'

const faviconSelector = 'link[data-jingwei-brand-favicon]'

function faviconLinkType(contentType: string | null): string {
  if (contentType === 'image/x-icon') return 'image/x-icon'
  return 'image/png'
}

export function applyDocumentBrand(brand: EffectiveBrand, pageTitle?: string): void {
  document.title =
    brand.titleMode === 'PAGE_AND_SYSTEM' && pageTitle !== undefined && pageTitle !== ''
      ? `${pageTitle} · ${brand.systemName}`
      : brand.systemName

  let description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (description === null) {
    description = document.createElement('meta')
    description.name = 'description'
    document.head.append(description)
  }
  description.content = brand.loginTagline || brand.systemName

  document.querySelector(faviconSelector)?.remove()
  const favicon = document.createElement('link')
  favicon.rel = 'icon'
  favicon.type =
    brand.faviconUrl === null
      ? platformDefaultFavicon.type
      : faviconLinkType(brand.faviconContentType)
  favicon.href = brand.faviconUrl ?? platformDefaultFavicon.href
  favicon.dataset.jingweiBrandFavicon = ''
  document.head.append(favicon)
}
