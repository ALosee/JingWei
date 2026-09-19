import { SaxesParser } from 'saxes'

import { ApplicationError } from '@jingwei/kernel'

import {
  brandLogoSvgLocalReference,
  brandLogoSvgNamespace,
  brandLogoSvgXlinkNamespace,
  brandSvgGeometryViolation,
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
  type BrandSvgPurpose,
} from '../../shared/index.js'

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10] as const
const ihdrLength = 13
const icoDibHeaderSizes = new Set([12, 40, 52, 56, 108, 124])
const icoDibBitDepths = new Set([1, 4, 8, 16, 24, 32])

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

function hasPngSignature(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= pngSignature.length &&
    pngSignature.every((value, index) => bytes[index] === value)
  )
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

function validatePng(bytes: Uint8Array): { width: number; height: number } {
  if (!hasPngSignature(bytes) || bytes.byteLength < 45) invalid('PNG 数据不完整')
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
  return { width, height }
}

function decodeSvg(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    invalid('品牌 SVG 必须使用 UTF-8 编码')
  }
}

function validateSvgStructure(source: string): BrandLogoSvgViewBox {
  if (/<!DOCTYPE/i.test(source)) invalid('品牌 SVG 不允许 DOCTYPE 或 XML Entity')
  const parser = new SaxesParser({ xmlns: true })
  let depth = 0
  let elements = 0
  const parsed: { rootViewBox: BrandLogoSvgViewBox | null } = { rootViewBox: null }
  let violation: string | null = null
  let descriptiveTextLength = 0
  const elementStack: string[] = []
  const definitions = new Map<string, 'CLIP_PATH' | 'GRADIENT' | 'MASK'>()
  const references: { id: string; expected: 'CLIP_PATH' | 'GRADIENT' | 'MASK'; label: string }[] =
    []

  parser.on('xmldecl', (declaration) => {
    if (declaration.version !== undefined && declaration.version !== '1.0')
      violation = firstViolation(violation, '品牌 SVG 只支持 XML 1.0')
    if (
      declaration.encoding !== undefined &&
      declaration.encoding.toLowerCase().replaceAll('-', '') !== 'utf8'
    )
      violation = firstViolation(violation, '品牌 SVG 必须声明 UTF-8 编码')
  })
  parser.on('doctype', () => {
    violation = firstViolation(violation, '品牌 SVG 不允许 DOCTYPE 或 XML Entity')
  })
  parser.on('processinginstruction', () => {
    violation = firstViolation(violation, '品牌 SVG 不允许处理指令')
  })
  parser.on('cdata', () => {
    violation = firstViolation(violation, '品牌 SVG 不允许 CDATA')
  })
  parser.on('text', (text) => {
    if (text.trim() === '') return
    const parent = elementStack.at(-1)
    if (parent !== 'title' && parent !== 'desc') {
      violation = firstViolation(violation, '品牌 SVG 只允许 title/desc 中的说明文本')
      return
    }
    descriptiveTextLength += text.length
    if (descriptiveTextLength > 1024)
      violation = firstViolation(violation, '品牌 SVG 的说明文本不能超过 1024 个字符')
  })
  parser.on('opentag', (tag) => {
    const parent = elementStack.at(-1)
    elementStack.push(tag.local)
    depth++
    elements++
    if (depth > maximumBrandLogoSvgDepth)
      violation = firstViolation(violation, `品牌 SVG 嵌套不能超过 ${maximumBrandLogoSvgDepth} 层`)
    if (elements > maximumBrandLogoSvgElements)
      violation = firstViolation(
        violation,
        `品牌 SVG 图形元素不能超过 ${maximumBrandLogoSvgElements} 个`,
      )
    if (tag.uri !== brandLogoSvgNamespace || !isBrandLogoSvgElement(tag.local)) {
      violation = firstViolation(violation, `品牌 SVG 不允许元素 <${tag.name}>`)
      return
    }
    if (elements === 1 && tag.local !== 'svg') {
      violation = firstViolation(violation, '品牌 SVG 根元素必须是 <svg>')
      return
    }
    if (elements > 1 && tag.local === 'svg') {
      violation = firstViolation(violation, '品牌 SVG 不允许嵌套 <svg>')
      return
    }
    if (parent === 'title' || parent === 'desc') {
      violation = firstViolation(violation, `品牌 SVG 的 <${parent}> 只能包含文本`)
      return
    }
    const attributes = Object.values(tag.attributes)
    if (attributes.length > maximumBrandLogoSvgAttributesPerElement)
      violation = firstViolation(
        violation,
        `每个品牌 SVG 元素最多允许 ${maximumBrandLogoSvgAttributesPerElement} 个属性`,
      )
    for (const attribute of attributes) {
      const namespaceDeclaration = attribute.uri === 'http://www.w3.org/2000/xmlns/'
      if (namespaceDeclaration) {
        const primaryNamespace =
          elements === 1 && attribute.name === 'xmlns' && attribute.value === brandLogoSvgNamespace
        const unusedXlinkNamespace =
          elements === 1 &&
          attribute.name === 'xmlns:xlink' &&
          attribute.value === brandLogoSvgXlinkNamespace
        if (!primaryNamespace && !unusedXlinkNamespace)
          violation = firstViolation(violation, '品牌 SVG 不允许额外的 XML 命名空间')
        continue
      }
      if (attribute.uri !== '' || attribute.prefix !== '') {
        violation = firstViolation(violation, `品牌 SVG 不允许命名空间属性 ${attribute.name}`)
        continue
      }
      const reason = validateBrandLogoSvgAttribute(tag.local, attribute.local, attribute.value)
      if (reason !== null) violation = firstViolation(violation, reason)
      if (
        attribute.local === 'id' &&
        (tag.local === 'clipPath' ||
          tag.local === 'linearGradient' ||
          tag.local === 'radialGradient' ||
          tag.local === 'mask')
      ) {
        if (definitions.has(attribute.value))
          violation = firstViolation(violation, `品牌 SVG 的 id ${attribute.value} 重复`)
        definitions.set(
          attribute.value,
          tag.local === 'clipPath' ? 'CLIP_PATH' : tag.local === 'mask' ? 'MASK' : 'GRADIENT',
        )
      }
      if (
        attribute.local === 'clip-path' ||
        attribute.local === 'mask' ||
        attribute.local === 'fill' ||
        attribute.local === 'stroke'
      ) {
        const reference = brandLogoSvgLocalReference(attribute.value)
        if (reference !== null)
          references.push({
            id: reference,
            expected:
              attribute.local === 'clip-path'
                ? 'CLIP_PATH'
                : attribute.local === 'mask'
                  ? 'MASK'
                  : 'GRADIENT',
            label: attribute.local,
          })
      }
      if (elements === 1 && attribute.local === 'viewBox')
        parsed.rootViewBox = parseBrandLogoSvgViewBox(attribute.value)
    }
  })
  parser.on('closetag', () => {
    elementStack.pop()
    depth--
  })
  parser.on('error', () => {
    violation = firstViolation(violation, '品牌 SVG 的 XML 结构无效')
  })

  try {
    parser.write(source).close()
  } catch {
    violation = firstViolation(violation, '品牌 SVG 的 XML 结构无效')
  }
  for (const reference of references) {
    if (definitions.get(reference.id) !== reference.expected)
      violation = firstViolation(
        violation,
        `品牌 SVG 的 ${reference.label} 引用了不存在或类型不匹配的定义 #${reference.id}`,
      )
  }
  if (violation !== null) invalid(violation)
  if (elements === 0 || parsed.rootViewBox === null) invalid('品牌 SVG 必须包含有效的 viewBox')
  return parsed.rootViewBox
}

function validateSvg(bytes: Uint8Array, purpose: BrandSvgPurpose): ValidatedBrandImage {
  const viewBox = validateSvgStructure(decodeSvg(bytes))
  const geometryViolation = brandSvgGeometryViolation(purpose, viewBox)
  if (geometryViolation !== null) invalid(geometryViolation)
  return {
    contentType: 'image/svg+xml',
    validationProfile: 'BRAND_LOGO_SVG_V2',
    width: Math.ceil(viewBox.width),
    height: Math.ceil(viewBox.height),
    byteSize: bytes.byteLength,
  }
}

function isIcoSignature(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 6 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0
  )
}

function dibRowBytes(width: number, bitsPerPixel: number): number {
  return Math.ceil((width * bitsPerPixel) / 32) * 4
}

function validateDibIcoFrame(
  frame: Uint8Array,
  directoryWidth: number,
  directoryHeight: number,
  directoryPlanes: number,
  directoryBitDepth: number,
): void {
  if (frame.byteLength < 12) invalid('Favicon ICO DIB 帧数据不完整')
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength)
  const headerSize = view.getUint32(0, true)
  if (!icoDibHeaderSizes.has(headerSize) || headerSize > frame.byteLength)
    invalid('Favicon ICO 使用了不支持的 DIB 文件头')

  const coreHeader = headerSize === 12
  const width = coreHeader ? view.getUint16(4, true) : view.getInt32(4, true)
  const encodedHeight = coreHeader ? view.getUint16(6, true) : view.getInt32(8, true)
  const planes = view.getUint16(coreHeader ? 8 : 12, true)
  const bitDepth = view.getUint16(coreHeader ? 10 : 14, true)
  if (width < 1 || encodedHeight < 2 || encodedHeight % 2 !== 0) invalid('Favicon ICO DIB 尺寸无效')
  const height = encodedHeight / 2
  if (width !== directoryWidth || height !== directoryHeight)
    invalid('Favicon ICO 目录尺寸与 DIB 帧不一致')
  if (planes !== 1 || (directoryPlanes !== 0 && directoryPlanes !== planes))
    invalid('Favicon ICO DIB 色彩平面无效')
  if (!icoDibBitDepths.has(bitDepth)) invalid('Favicon ICO DIB 位深无效')
  if (directoryBitDepth !== 0 && directoryBitDepth !== bitDepth)
    invalid('Favicon ICO 目录位深与 DIB 帧不一致')

  const compression = coreHeader ? 0 : view.getUint32(16, true)
  const bitfields = compression === 3
  const alphaBitfields = compression === 6
  if (
    (compression !== 0 && !bitfields && !alphaBitfields) ||
    ((bitfields || alphaBitfields) && bitDepth !== 16 && bitDepth !== 32)
  )
    invalid('Favicon ICO DIB 压缩方式不受支持')

  const colorsUsed = coreHeader ? 0 : view.getUint32(32, true)
  const maximumPaletteEntries = bitDepth <= 8 ? 2 ** bitDepth : 256
  const paletteEntries = bitDepth <= 8 && colorsUsed === 0 ? maximumPaletteEntries : colorsUsed
  if (paletteEntries > maximumPaletteEntries) invalid('Favicon ICO DIB 调色板无效')

  const externalMaskBytes =
    headerSize === 40 && bitfields ? 12 : headerSize === 40 && alphaBitfields ? 16 : 0
  const paletteEntryBytes = coreHeader ? 3 : 4
  const pixelOffset = headerSize + externalMaskBytes + paletteEntries * paletteEntryBytes
  const xorBytes = dibRowBytes(width, bitDepth) * height
  const maskBytes = dibRowBytes(width, 1) * height
  const xorEnd = pixelOffset + xorBytes
  const frameEnd = xorEnd + maskBytes
  const omitsOptional32BitMask = bitDepth === 32 && frame.byteLength === xorEnd
  if (!omitsOptional32BitMask && frame.byteLength !== frameEnd)
    invalid('Favicon ICO DIB 像素或透明蒙版数据不完整')
}

function validateIcoFavicon(bytes: Uint8Array): ValidatedBrandImage {
  if (!isIcoSignature(bytes) || bytes.byteLength < 22) invalid('Favicon ICO 文件头无效')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = view.getUint16(4, true)
  if (count < 1 || count > 10) invalid('Favicon ICO 帧数无效')
  const directoryEnd = 6 + count * 16
  if (directoryEnd > bytes.byteLength) invalid('ICO 数据不完整')
  let maxWidth = 0
  const frameRanges: { start: number; end: number }[] = []
  for (let index = 0; index < count; index++) {
    const entry = 6 + index * 16
    const width = bytes[entry] === 0 ? 256 : (bytes[entry] ?? 0)
    const height = bytes[entry + 1] === 0 ? 256 : (bytes[entry + 1] ?? 0)
    const planes = view.getUint16(entry + 4, true)
    const bitDepth = view.getUint16(entry + 6, true)
    if (width < 16 || width > 256 || height !== width)
      invalid('Favicon ICO 图标必须是 16–256 的正方形')
    if (bytes[entry + 3] !== 0) invalid('Favicon ICO 目录项无效')
    const frameBytes = view.getUint32(entry + 8, true)
    const frameOffset = view.getUint32(entry + 12, true)
    if (frameBytes < 1 || frameOffset < directoryEnd || frameOffset + frameBytes > bytes.byteLength)
      invalid('ICO 帧数据越界')
    const frame = bytes.subarray(frameOffset, frameOffset + frameBytes)
    if (hasPngSignature(frame)) {
      const png = validatePng(frame)
      if (png.width !== width || png.height !== height)
        invalid('Favicon ICO 目录尺寸与 PNG 帧不一致')
    } else {
      validateDibIcoFrame(frame, width, height, planes, bitDepth)
    }
    frameRanges.push({ start: frameOffset, end: frameOffset + frameBytes })
    maxWidth = Math.max(maxWidth, width)
  }
  frameRanges.sort((left, right) => left.start - right.start)
  for (let index = 1; index < frameRanges.length; index++) {
    const previous = frameRanges[index - 1]
    const current = frameRanges[index]
    if (previous !== undefined && current !== undefined && current.start < previous.end)
      invalid('Favicon ICO 帧数据不能重叠')
  }
  return {
    contentType: 'image/x-icon',
    validationProfile: 'ICO_V2',
    width: maxWidth,
    height: maxWidth,
    byteSize: bytes.byteLength,
  }
}

/** Validates actual bytes and purpose-specific geometry; client MIME metadata is not trusted. */
export function validateBrandImage(
  purpose: BrandAssetPurpose,
  bytes: Uint8Array,
): ValidatedBrandImage {
  if (bytes.byteLength === 0 || bytes.byteLength > maximumBrandAssetBytes)
    invalid('品牌图片必须小于 2 MiB')
  const png = hasPngSignature(bytes)
  if (!png) {
    if (isIcoSignature(bytes)) {
      if (purpose !== 'FAVICON') invalid('只有 Favicon 支持 ICO 格式')
      return validateIcoFavicon(bytes)
    }
    if (purpose === 'LOGO' || purpose === 'MARK') return validateSvg(bytes, purpose)
    invalid('Favicon 必须是 PNG 或 ICO 格式')
  }
  const { width, height } = validatePng(bytes)

  if (purpose === 'LOGO') {
    if (width > 1600 || height > 600 || width < 64 || height < 24)
      invalid('Logo 尺寸必须在 64×24 至 1600×600 之间')
    if (!hasValidBrandLogoAspectRatio(width, height))
      invalid('横向 Logo 宽高比必须在 1:1 至 12:1 之间')
  } else if (purpose === 'MARK' && (width !== height || width < 32 || width > 512)) {
    invalid('方形标志 PNG 必须是 32–512 像素的正方形')
  } else if (purpose === 'FAVICON' && (width !== height || width < 16 || width > 512)) {
    invalid('Favicon PNG 必须是 16–512 像素的正方形')
  }

  return {
    contentType: 'image/png',
    validationProfile: 'PNG_V1',
    width,
    height,
    byteSize: bytes.byteLength,
  }
}
