import { SaxesParser } from 'saxes'

import { ApplicationError } from '@jingwei/kernel'

import {
  brandLogoSvgNamespace,
  hasValidBrandLogoAspectRatio,
  isBrandLogoSvgElement,
  maximumBrandAssetBytes,
  maximumBrandLogoSvgAttributesPerElement,
  maximumBrandLogoSvgDepth,
  maximumBrandLogoSvgElements,
  parseBrandLogoSvgViewBox,
  validateBrandLogoSvgAttribute,
  type BrandAssetContentType,
  type BrandAssetPurpose,
  type BrandAssetValidationProfile,
  type BrandLogoSvgViewBox,
} from '../../shared/index.js'

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10] as const
const ihdrLength = 13

export interface ValidatedBrandImage {
  readonly contentType: BrandAssetContentType
  readonly validationProfile: BrandAssetValidationProfile
  readonly width: number
  readonly height: number
  readonly byteSize: number
}

function invalid(message: string): never {
  throw new ApplicationError({ code: 'BRANDING_ASSET_INVALID', message, status: 422 })
}

function firstViolation(current: string | null, next: string): string {
  return current ?? next
}

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff
  for (let index = start; index < end; index++) {
    crc ^= bytes[index] ?? 0
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function readChunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + 4))
}

function validatePngStructure(bytes: Uint8Array, view: DataView): void {
  let offset = pngSignature.length
  let chunks = 0
  let hasImageData = false
  let hasEnd = false

  while (offset < bytes.byteLength) {
    if (offset + 12 > bytes.byteLength) invalid('PNG 数据不完整')
    const length = view.getUint32(offset)
    const typeOffset = offset + 4
    const dataOffset = typeOffset + 4
    const crcOffset = dataOffset + length
    if (crcOffset + 4 > bytes.byteLength) invalid('PNG 数据不完整')
    const type = readChunkType(bytes, typeOffset)
    if (chunks === 0 && (type !== 'IHDR' || length !== ihdrLength)) invalid('PNG 文件头无效')
    if (view.getUint32(crcOffset) !== crc32(bytes, typeOffset, crcOffset))
      invalid('PNG 数据校验失败')
    if (type === 'IDAT') hasImageData = true
    if (type === 'IEND') {
      if (length !== 0 || crcOffset + 4 !== bytes.byteLength) invalid('PNG 结束标记无效')
      hasEnd = true
    }
    chunks++
    offset = crcOffset + 4
  }
  if (!hasImageData || !hasEnd) invalid('PNG 数据不完整')
}

function decodeSvg(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    invalid('Logo SVG 必须使用 UTF-8 编码')
  }
}

function validateSvgStructure(source: string): BrandLogoSvgViewBox {
  if (/<!DOCTYPE/i.test(source)) invalid('Logo SVG 不允许 DOCTYPE 或 XML Entity')
  const parser = new SaxesParser({ xmlns: true })
  let depth = 0
  let elements = 0
  const parsed: { rootViewBox: BrandLogoSvgViewBox | null } = { rootViewBox: null }
  let violation: string | null = null

  parser.on('xmldecl', (declaration) => {
    if (declaration.version !== undefined && declaration.version !== '1.0')
      violation = firstViolation(violation, 'Logo SVG 只支持 XML 1.0')
    if (
      declaration.encoding !== undefined &&
      declaration.encoding.toLowerCase().replaceAll('-', '') !== 'utf8'
    )
      violation = firstViolation(violation, 'Logo SVG 必须声明 UTF-8 编码')
  })
  parser.on('doctype', () => {
    violation = firstViolation(violation, 'Logo SVG 不允许 DOCTYPE 或 XML Entity')
  })
  parser.on('processinginstruction', () => {
    violation = firstViolation(violation, 'Logo SVG 不允许处理指令')
  })
  parser.on('comment', () => {
    violation = firstViolation(violation, 'Logo SVG 不允许注释')
  })
  parser.on('cdata', () => {
    violation = firstViolation(violation, 'Logo SVG 不允许 CDATA')
  })
  parser.on('text', (text) => {
    if (text.trim() !== '') violation = firstViolation(violation, 'Logo SVG 不允许文本节点')
  })
  parser.on('opentag', (tag) => {
    depth++
    elements++
    if (depth > maximumBrandLogoSvgDepth)
      violation = firstViolation(violation, `Logo SVG 嵌套不能超过 ${maximumBrandLogoSvgDepth} 层`)
    if (elements > maximumBrandLogoSvgElements)
      violation = firstViolation(
        violation,
        `Logo SVG 图形元素不能超过 ${maximumBrandLogoSvgElements} 个`,
      )
    if (tag.uri !== brandLogoSvgNamespace || !isBrandLogoSvgElement(tag.local)) {
      violation = firstViolation(violation, `Logo SVG 不允许元素 <${tag.name}>`)
      return
    }
    if (elements === 1 && tag.local !== 'svg') {
      violation = firstViolation(violation, 'Logo SVG 根元素必须是 <svg>')
      return
    }
    if (elements > 1 && tag.local === 'svg') {
      violation = firstViolation(violation, 'Logo SVG 不允许嵌套 <svg>')
      return
    }
    const attributes = Object.values(tag.attributes)
    if (attributes.length > maximumBrandLogoSvgAttributesPerElement)
      violation = firstViolation(
        violation,
        `每个 Logo SVG 元素最多允许 ${maximumBrandLogoSvgAttributesPerElement} 个属性`,
      )
    for (const attribute of attributes) {
      const namespaceDeclaration = attribute.uri === 'http://www.w3.org/2000/xmlns/'
      if (namespaceDeclaration) {
        if (
          elements !== 1 ||
          attribute.name !== 'xmlns' ||
          attribute.value !== brandLogoSvgNamespace
        )
          violation = firstViolation(violation, 'Logo SVG 不允许额外的 XML 命名空间')
        continue
      }
      if (attribute.uri !== '' || attribute.prefix !== '') {
        violation = firstViolation(violation, `Logo SVG 不允许命名空间属性 ${attribute.name}`)
        continue
      }
      const reason = validateBrandLogoSvgAttribute(tag.local, attribute.local, attribute.value)
      if (reason !== null) violation = firstViolation(violation, reason)
      if (elements === 1 && attribute.local === 'viewBox')
        parsed.rootViewBox = parseBrandLogoSvgViewBox(attribute.value)
    }
  })
  parser.on('closetag', () => {
    depth--
  })
  parser.on('error', () => {
    violation = firstViolation(violation, 'Logo SVG 的 XML 结构无效')
  })

  try {
    parser.write(source).close()
  } catch {
    violation = firstViolation(violation, 'Logo SVG 的 XML 结构无效')
  }
  if (violation !== null) invalid(violation)
  if (elements === 0 || parsed.rootViewBox === null) invalid('Logo SVG 必须包含有效的 viewBox')
  return parsed.rootViewBox
}

function validateSvgLogo(bytes: Uint8Array): ValidatedBrandImage {
  const viewBox = validateSvgStructure(decodeSvg(bytes))
  if (!hasValidBrandLogoAspectRatio(viewBox.width, viewBox.height))
    invalid('横向 Logo 宽高比必须在 1:1 至 12:1 之间')
  return {
    contentType: 'image/svg+xml',
    validationProfile: 'BRAND_LOGO_SVG_V1',
    width: Math.ceil(viewBox.width),
    height: Math.ceil(viewBox.height),
    byteSize: bytes.byteLength,
  }
}

/** Validates actual bytes and purpose-specific geometry; client MIME metadata is not trusted. */
export function validateBrandImage(
  purpose: BrandAssetPurpose,
  bytes: Uint8Array,
): ValidatedBrandImage {
  if (bytes.byteLength === 0 || bytes.byteLength > maximumBrandAssetBytes)
    invalid('品牌图片必须小于 512 KiB')
  const png =
    bytes.byteLength >= pngSignature.length &&
    pngSignature.every((value, index) => bytes[index] === value)
  if (!png) {
    if (purpose !== 'LOGO') invalid('方形标志和 favicon 必须是 PNG 格式')
    return validateSvgLogo(bytes)
  }
  if (bytes.byteLength < 45) invalid('PNG 数据不完整')

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  validatePngStructure(bytes, view)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  if (width === 0 || height === 0) invalid('PNG 尺寸无效')
  const bitDepth = bytes[24]
  const colorType = bytes[25]
  const validBitDepth =
    (colorType === 0 && [1, 2, 4, 8, 16].includes(bitDepth ?? -1)) ||
    (colorType === 2 && [8, 16].includes(bitDepth ?? -1)) ||
    (colorType === 3 && [1, 2, 4, 8].includes(bitDepth ?? -1)) ||
    ((colorType === 4 || colorType === 6) && [8, 16].includes(bitDepth ?? -1))
  if (!validBitDepth || bytes[26] !== 0 || bytes[27] !== 0 || (bytes[28] !== 0 && bytes[28] !== 1))
    invalid('PNG 编码参数无效')

  if (purpose === 'LOGO') {
    if (width > 1600 || height > 600 || width < 64 || height < 24)
      invalid('Logo 尺寸必须在 64×24 至 1600×600 之间')
    if (!hasValidBrandLogoAspectRatio(width, height))
      invalid('横向 Logo 宽高比必须在 1:1 至 12:1 之间')
  } else if (width !== height || width < 32 || width > 512) {
    invalid('方形标志和 favicon 必须是 32–512 像素的正方形 PNG')
  }

  return {
    contentType: 'image/png',
    validationProfile: 'PNG_V1',
    width,
    height,
    byteSize: bytes.byteLength,
  }
}
