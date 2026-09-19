// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'

import { brandSvgProfileContractFixtures } from '../shared/brand-svg-profile.contract-fixtures.js'
import { validateBrandSvgText } from './brand-logo-svg-validation.js'

describe('validateBrandSvgText', () => {
  it.each(brandSvgProfileContractFixtures)(
    'matches the shared SVG contract: $name',
    ({ purpose, source, expected }) => {
      const validate = () => validateBrandSvgText(source, purpose)
      if (expected === 'ACCEPT') expect(validate).not.toThrow()
      else expect(validate).toThrow()
    },
  )

  it('accepts the same minimal drawing profile in the browser', () => {
    expect(() =>
      validateBrandSvgText(
        `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 24">
          <g fill="currentColor"><path d="M0 0h140v24H0z" /></g>
        </svg>
      `,
        'LOGO',
      ),
    ).not.toThrow()
  })

  it('rejects active SVG content before upload', () => {
    expect(() =>
      validateBrandSvgText(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"/>',
        'LOGO',
      ),
    ).toThrow(/不允许属性 onload/)
  })

  it('rejects a viewBox that cannot display well in the horizontal logo slot', () => {
    expect(() =>
      validateBrandSvgText(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 24"><path d="M0 0h2000v24H0z"/></svg>',
        'LOGO',
      ),
    ).toThrow(/宽高比/)
  })

  it('uses mark geometry and accepts safe internal clip paths', () => {
    expect(() =>
      validateBrandSvgText(
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
          version="1.1" viewBox="0 0 36 36" width="100%" height="100%">
          <defs><clipPath id="mark_clip"><rect width="36" height="36" rx="8"/></clipPath></defs>
          <path clip-path="url(#mark_clip)" d="M4 4h28v28H4z"
            style="mix-blend-mode:passthrough"/>
        </svg>`,
        'MARK',
      ),
    ).not.toThrow()
    expect(() =>
      validateBrandSvgText(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32"><path d="M0 0h1v1z"/></svg>',
        'MARK',
      ),
    ).toThrow(/必须是正方形/)
  })
})
