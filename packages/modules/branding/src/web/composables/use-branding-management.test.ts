import { describe, expect, it } from 'vitest'

import type { SaveBrandDraft } from '../../shared/index.js'
import { validateSaveBrandDraft } from './brand-draft-validation.js'

const validDraft: SaveBrandDraft = {
  expectedEditRevision: 0,
  systemName: '经纬企业平台',
  shortName: '经纬',
  loginTitle: '经纬企业平台',
  loginTagline: '让协作有迹可循。',
  titleMode: 'PAGE_AND_SYSTEM',
  horizontalBrandMode: 'PLATFORM_WORDMARK',
  logoColorMode: 'FOLLOW_THEME',
  logoAssetId: null,
  markAssetId: null,
  faviconAssetId: null,
}

describe('validateSaveBrandDraft', () => {
  it('accepts a complete draft and trims text fields', () => {
    const result = validateSaveBrandDraft({
      ...validDraft,
      systemName: '  经纬企业平台  ',
      shortName: ' 经纬 ',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.systemName).toBe('经纬企业平台')
    expect(result.data.shortName).toBe('经纬')
  })

  it('rejects an empty short name with a field-level message', () => {
    const result = validateSaveBrandDraft({ ...validDraft, shortName: '   ' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.shortName).toBe('系统简称不能为空')
  })

  it('rejects an empty system name and login title', () => {
    const result = validateSaveBrandDraft({
      ...validDraft,
      systemName: '',
      loginTitle: '',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.systemName).toBe('系统全称不能为空')
    expect(result.errors.loginTitle).toBe('登录页标题不能为空')
  })

  it('requires an uploaded asset when custom Logo display is selected', () => {
    const result = validateSaveBrandDraft({
      ...validDraft,
      horizontalBrandMode: 'CUSTOM_LOGO',
      logoAssetId: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.logoAssetId).toContain('必须上传横向 Logo')
  })
})
