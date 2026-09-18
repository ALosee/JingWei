// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'

import { defaultEffectiveBrand, type EffectiveBrand } from '@jingwei/module-branding/shared'

import { applyDocumentBrand } from './document-brand.js'

afterEach(() => {
  document.head.innerHTML = ''
  document.title = ''
})

describe('document brand projection', () => {
  it('updates the title, description and replaces the owned favicon', () => {
    const brand: EffectiveBrand = {
      ...defaultEffectiveBrand,
      source: 'PUBLISHED',
      publishedRevision: 3,
      systemName: '客户平台',
      loginTagline: '客户专属工作空间',
      faviconUrl: 'data:image/png;base64,AA==',
    }
    applyDocumentBrand(brand, '账号设置')
    applyDocumentBrand({ ...brand, faviconUrl: 'data:image/png;base64,AQ==' }, '组织管理')

    expect(document.title).toBe('组织管理 · 客户平台')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      '客户专属工作空间',
    )
    const favicons = document.querySelectorAll('link[data-jingwei-brand-favicon]')
    expect(favicons).toHaveLength(1)
    expect(favicons[0]?.getAttribute('href')).toBe('data:image/png;base64,AQ==')
  })

  it('falls back to a system-only title and removes a previous custom favicon', () => {
    applyDocumentBrand(
      { ...defaultEffectiveBrand, faviconUrl: 'data:image/png;base64,AA==' },
      '账号设置',
    )
    applyDocumentBrand({ ...defaultEffectiveBrand, titleMode: 'SYSTEM_ONLY' }, '组织管理')

    expect(document.title).toBe(defaultEffectiveBrand.systemName)
    expect(document.querySelector('link[data-jingwei-brand-favicon]')).toBeNull()
  })
})
