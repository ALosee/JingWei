import { deflateSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { validateBrandImage } from './brand-image.js'

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, 'ascii')
  const result = Buffer.alloc(data.byteLength + 12)
  result.writeUInt32BE(data.byteLength, 0)
  typeBytes.copy(result, 4)
  Buffer.from(data).copy(result, 8)
  result.writeUInt32BE(crc32(result.subarray(4, result.byteLength - 4)), result.byteLength - 4)
  return result
}

function grayscalePng(width: number, height: number): Uint8Array {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 0
  const scanlines = Buffer.alloc((width + 1) * height)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND', new Uint8Array()),
  ])
}

function svg(source: string): Uint8Array {
  return new TextEncoder().encode(source)
}

describe('brand image validation', () => {
  it('accepts structurally valid PNGs within purpose-specific dimensions', () => {
    expect(validateBrandImage('MARK', grayscalePng(64, 64))).toMatchObject({
      contentType: 'image/png',
      width: 64,
      height: 64,
    })
    expect(validateBrandImage('LOGO', grayscalePng(320, 96))).toMatchObject({
      width: 320,
      height: 96,
    })
  })

  it('rejects a spoofed header and corrupted PNG chunks', () => {
    const spoofed = new Uint8Array(64)
    spoofed.set([137, 80, 78, 71, 13, 10, 26, 10])
    expect(() => validateBrandImage('MARK', spoofed)).toThrow(
      expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
    )

    const corrupted = grayscalePng(64, 64)
    const last = corrupted.byteLength - 1
    corrupted[last] = (corrupted[last] ?? 0) ^ 1
    expect(() => validateBrandImage('MARK', corrupted)).toThrow(
      expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
    )
  })

  it('enforces square icon and bounded logo geometry', () => {
    expect(() => validateBrandImage('FAVICON', grayscalePng(64, 48))).toThrow(
      expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
    )
    expect(() => validateBrandImage('LOGO', grayscalePng(32, 32))).toThrow(
      expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
    )
  })

  it('rejects horizontal logos with impractical aspect ratios in both formats', () => {
    expect(() => validateBrandImage('LOGO', grayscalePng(64, 600))).toThrow(
      expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
    )
    expect(() => validateBrandImage('LOGO', grayscalePng(1600, 24))).toThrow(
      expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
    )
    expect(() =>
      validateBrandImage(
        'LOGO',
        svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 320"/>'),
      ),
    ).toThrow(expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }))
    expect(() =>
      validateBrandImage(
        'LOGO',
        svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 24"/>'),
      ),
    ).toThrow(expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }))
  })

  it('accepts a Logo SVG made only from the strict drawing subset', () => {
    expect(
      validateBrandImage(
        'LOGO',
        svg(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 96">
            <g fill="#0f172a" transform="translate(4 4)">
              <path d="M0 0h80v40H0z" />
              <line x1="96" y1="0" x2="200" y2="40" stroke="currentColor" stroke-width="4" />
            </g>
          </svg>
        `),
      ),
    ).toMatchObject({ contentType: 'image/svg+xml', width: 320, height: 96 })
  })

  it('rejects active, externally referenced or structurally unnecessary SVG content', () => {
    const invalidSources = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"/>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><foreignObject/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="url(https://example.com/a.svg)" d="M0 0h1v1z"/></svg>',
      '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>',
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>',
    ]
    for (const source of invalidSources) {
      expect(() => validateBrandImage('LOGO', svg(source))).toThrow(
        expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
      )
    }
  })

  it('does not allow SVG for square mark or favicon assets', () => {
    const source = svg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="24"/></svg>',
    )
    expect(() => validateBrandImage('MARK', source)).toThrow(
      expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
    )
    expect(() => validateBrandImage('FAVICON', source)).toThrow(
      expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
    )
  })
})
