// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'

import { validateBrandLogoSvgText } from './brand-logo-svg-validation.js'

describe('validateBrandLogoSvgText', () => {
  it('accepts the same minimal drawing profile in the browser', () => {
    expect(() =>
      validateBrandLogoSvgText(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 24">
          <g fill="currentColor"><path d="M0 0h140v24H0z" /></g>
        </svg>
      `),
    ).not.toThrow()
  })

  it('rejects active SVG content before upload', () => {
    expect(() =>
      validateBrandLogoSvgText(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"/>',
      ),
    ).toThrow(/不允许属性 onload/)
  })

  it('rejects a viewBox that cannot display well in the horizontal logo slot', () => {
    expect(() =>
      validateBrandLogoSvgText(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 24"><path d="M0 0h2000v24H0z"/></svg>',
      ),
    ).toThrow(/宽高比/)
  })
})
