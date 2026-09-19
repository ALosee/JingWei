import { deflateSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { brandSvgProfileContractFixtures } from '../../shared/brand-svg-profile.contract-fixtures.js'
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

function buildSquareIco(size: number): Uint8Array {
  const directory = Buffer.alloc(6 + 16)
  directory.writeUInt16LE(0, 0)
  directory.writeUInt16LE(1, 2)
  directory.writeUInt16LE(1, 4)
  const framePayload = Buffer.from(grayscalePng(size, size))
  const offset = directory.byteLength
  directory[6] = size >= 256 ? 0 : size
  directory[7] = size >= 256 ? 0 : size
  directory.writeUInt16LE(1, 10)
  directory.writeUInt16LE(32, 12)
  directory.writeUInt32LE(framePayload.byteLength, 14)
  directory.writeUInt32LE(offset, 18)
  return new Uint8Array(Buffer.concat([directory, framePayload]))
}

function buildDibIco(size: number): Uint8Array {
  const header = Buffer.alloc(40)
  const xorStride = Math.ceil((size * 32) / 32) * 4
  const maskStride = Math.ceil(size / 32) * 4
  const xor = Buffer.alloc(xorStride * size)
  const mask = Buffer.alloc(maskStride * size)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(0, 16)
  header.writeUInt32LE(xor.byteLength, 20)

  const framePayload = Buffer.concat([header, xor, mask])
  const directory = Buffer.alloc(6 + 16)
  directory.writeUInt16LE(1, 2)
  directory.writeUInt16LE(1, 4)
  directory[6] = size >= 256 ? 0 : size
  directory[7] = size >= 256 ? 0 : size
  directory.writeUInt16LE(1, 10)
  directory.writeUInt16LE(32, 12)
  directory.writeUInt32LE(framePayload.byteLength, 14)
  directory.writeUInt32LE(directory.byteLength, 18)
  return new Uint8Array(Buffer.concat([directory, framePayload]))
}

describe('brand image validation', () => {
  it.each(brandSvgProfileContractFixtures)(
    'matches the shared SVG contract: $name',
    ({ purpose, source, expected }) => {
      const validate = () => validateBrandImage(purpose, svg(source))
      if (expected === 'ACCEPT') expect(validate).not.toThrow()
      else expect(validate).toThrow(expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }))
    },
  )

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
    expect(validateBrandImage('FAVICON', grayscalePng(16, 16))).toMatchObject({
      width: 16,
      height: 16,
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
    ).toMatchObject({
      contentType: 'image/svg+xml',
      validationProfile: 'BRAND_LOGO_SVG_V2',
      width: 320,
      height: 96,
    })
  })

  it('accepts square mark SVG and rejects non-square mark SVG', () => {
    expect(
      validateBrandImage(
        'MARK',
        svg(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="24"/>
          </svg>
        `),
      ),
    ).toMatchObject({ contentType: 'image/svg+xml', width: 64, height: 64 })
    expect(() =>
      validateBrandImage(
        'MARK',
        svg(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32"><path d="M0 0h1v1z"/></svg>',
        ),
      ),
    ).toThrow(expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }))

    expect(
      validateBrandImage(
        'MARK',
        svg(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><path d="M0 0h1v1z"/></svg>',
        ),
      ),
    ).toMatchObject({ width: 1024, height: 1024 })
  })

  it('accepts safe design-tool clip paths without enabling external references', () => {
    const source = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
        version="1.1" viewBox="0 0 36 36" width="100%" height="100%">
        <defs><clipPath id="mark_clip"><rect x="0" y="0" width="36" height="36" rx="8"/></clipPath></defs>
        <g clip-path="url(#mark_clip)">
          <path d="M4 4h28v28H4z" fill="#A71E32" style="mix-blend-mode:passthrough"/>
        </g>
      </svg>
    `
    expect(validateBrandImage('MARK', svg(source))).toMatchObject({ width: 36, height: 36 })
    expect(() =>
      validateBrandImage(
        'MARK',
        svg(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path clip-path="url(https://example.com/clip.svg#x)" d="M0 0h1v1z"/></svg>',
        ),
      ),
    ).toThrow(expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }))
  })

  it('accepts ICO for favicon only and keeps favicon SVG rejected', () => {
    const ico = buildSquareIco(32)
    expect(validateBrandImage('FAVICON', ico)).toMatchObject({
      contentType: 'image/x-icon',
      validationProfile: 'ICO_V2',
      width: 32,
      height: 32,
    })
    expect(() => validateBrandImage('MARK', ico)).toThrow(
      expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
    )
    expect(() => validateBrandImage('LOGO', ico)).toThrow(
      expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
    )
    expect(() =>
      validateBrandImage(
        'FAVICON',
        svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"/>'),
      ),
    ).toThrow(expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }))
  })

  it('accepts a standard 32-bit BMP/DIB ICO frame', () => {
    expect(validateBrandImage('FAVICON', buildDibIco(113))).toMatchObject({
      contentType: 'image/x-icon',
      validationProfile: 'ICO_V2',
      width: 113,
      height: 113,
    })
  })

  it('rejects malformed ICO frame data', () => {
    const ico = buildSquareIco(32)
    ico.fill(0x80, 22)
    expect(() => validateBrandImage('FAVICON', ico)).toThrow(
      expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
    )

    const truncatedDib = buildDibIco(32).subarray(0, -1)
    expect(() => validateBrandImage('FAVICON', truncatedDib)).toThrow(
      expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
    )
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
      expect(() => validateBrandImage('MARK', svg(source))).toThrow(
        expect.objectContaining({ code: 'BRANDING_ASSET_INVALID' }),
      )
    }
  })
})
