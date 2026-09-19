import type { EffectiveBrand } from '@jingwei/module-branding/shared'

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
  if (brand.faviconUrl === null) return
  const favicon = document.createElement('link')
  favicon.rel = 'icon'
  favicon.type = faviconLinkType(brand.faviconContentType)
  favicon.href = brand.faviconUrl
  favicon.dataset.jingweiBrandFavicon = ''
  document.head.append(favicon)
}
