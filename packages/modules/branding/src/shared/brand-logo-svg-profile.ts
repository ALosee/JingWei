export const brandLogoSvgProfileVersion = 'BRAND_LOGO_SVG_V2' as const
export const brandLogoSvgNamespace = 'http://www.w3.org/2000/svg'
export const brandLogoSvgXlinkNamespace = 'http://www.w3.org/1999/xlink'
export const maximumBrandAssetBytes = 2 * 1024 * 1024
export const maximumBrandLogoSvgDepth = 32
export const maximumBrandLogoSvgElements = 256
export const maximumBrandLogoSvgAttributesPerElement = 32
export const minimumBrandLogoAspectRatio = 1
export const maximumBrandLogoAspectRatio = 12

export const brandLogoSvgElements = [
  'svg',
  'defs',
  'clipPath',
  'linearGradient',
  'radialGradient',
  'stop',
  'mask',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'title',
  'desc',
] as const

export type BrandLogoSvgElement = (typeof brandLogoSvgElements)[number]

const elementNames = new Set<string>(brandLogoSvgElements)
const commonAttributes = new Set([
  'clip-path',
  'mask',
  'fill',
  'fill-opacity',
  'fill-rule',
  'clip-rule',
  'opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'style',
  'transform',
  'vector-effect',
])
const elementAttributes: Record<BrandLogoSvgElement, ReadonlySet<string>> = {
  svg: new Set(['height', 'preserveAspectRatio', 'version', 'viewBox', 'width', 'x', 'y']),
  defs: new Set(),
  clipPath: new Set(['clipPathUnits', 'id']),
  linearGradient: new Set([
    'gradientTransform',
    'gradientUnits',
    'id',
    'spreadMethod',
    'x1',
    'x2',
    'y1',
    'y2',
  ]),
  radialGradient: new Set([
    'cx',
    'cy',
    'fr',
    'fx',
    'fy',
    'gradientTransform',
    'gradientUnits',
    'id',
    'r',
    'spreadMethod',
  ]),
  stop: new Set(['offset', 'stop-color', 'stop-opacity']),
  mask: new Set(['height', 'id', 'mask-type', 'maskContentUnits', 'maskUnits', 'width', 'x', 'y']),
  g: new Set(),
  path: new Set(['d']),
  rect: new Set(['height', 'rx', 'ry', 'width', 'x', 'y']),
  circle: new Set(['cx', 'cy', 'r']),
  ellipse: new Set(['cx', 'cy', 'rx', 'ry']),
  line: new Set(['x1', 'x2', 'y1', 'y2']),
  polyline: new Set(['points']),
  polygon: new Set(['points']),
  title: new Set(),
  desc: new Set(),
}

const numericAttributes = new Set([
  'cx',
  'cy',
  'fill-opacity',
  'fr',
  'fx',
  'fy',
  'height',
  'opacity',
  'r',
  'rx',
  'ry',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'stop-opacity',
  'width',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
])
const numericValue = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:px)?$/i
const percentageValue = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%$/i
const numericList = /^[\s,+\-.\dEe]+$/
const pathData = /^[\s,+\-.\dEeMmZzLlHhVvCcSsQqTtAa]+$/
const transformValue = /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\([\s,+\-.\dEe]+\)\s*)+$/
const colorValue =
  /^(?:none|currentColor|transparent|#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|[a-z]+|(?:rgb|rgba|hsl|hsla)\([\s,%+\-.\d]+\))$/i
const preserveAspectRatioValue = /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:\s+(?:meet|slice))?)$/
const svgIdValue = /^[A-Za-z_][\w.-]{0,127}$/
const localReferenceValue = /^url\(#([A-Za-z_][\w.-]{0,127})\)$/
const blendModes = new Set([
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
  // Common design-tool export value. Browsers that do not recognize it simply ignore it.
  'passthrough',
])

export interface BrandLogoSvgViewBox {
  readonly minX: number
  readonly minY: number
  readonly width: number
  readonly height: number
}

export type BrandSvgPurpose = 'LOGO' | 'MARK'

export function isBrandLogoSvgElement(value: string): value is BrandLogoSvgElement {
  return elementNames.has(value)
}

export function hasValidBrandLogoAspectRatio(width: number, height: number): boolean {
  const ratio = width / height
  return ratio >= minimumBrandLogoAspectRatio && ratio <= maximumBrandLogoAspectRatio
}

export function brandSvgGeometryViolation(
  purpose: BrandSvgPurpose,
  viewBox: BrandLogoSvgViewBox,
): string | null {
  if (purpose === 'MARK')
    return viewBox.width === viewBox.height ? null : '方形标志 SVG 必须是正方形'
  return hasValidBrandLogoAspectRatio(viewBox.width, viewBox.height)
    ? null
    : '横向 Logo 宽高比必须在 1:1 至 12:1 之间'
}

export function brandLogoSvgLocalReference(value: string): string | null {
  return localReferenceValue.exec(value)?.[1] ?? null
}

export function parseBrandLogoSvgViewBox(value: string): BrandLogoSvgViewBox | null {
  const parts = value.trim().split(/[\s,]+/)
  if (parts.length !== 4 || parts.some((part) => !numericValue.test(part))) return null
  const [minX, minY, width, height] = parts.map(Number)
  if (
    minX === undefined ||
    minY === undefined ||
    width === undefined ||
    height === undefined ||
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 100_000 ||
    height > 100_000
  )
    return null
  return { minX, minY, width, height }
}

function isUnitInterval(value: string): boolean {
  const percent = value.endsWith('%')
  const parsed = Number(percent ? value.slice(0, -1) : value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= (percent ? 100 : 1)
}

/** Returns a user-facing reason when an attribute is outside the current brand SVG profile. */
export function validateBrandLogoSvgAttribute(
  element: BrandLogoSvgElement,
  name: string,
  value: string,
): string | null {
  if (!commonAttributes.has(name) && !elementAttributes[element].has(name))
    return `元素 <${element}> 不允许属性 ${name}`
  if (name.startsWith('on')) return `品牌 SVG 不允许事件属性 ${name}`
  if (value.length === 0 || value.length > 100_000) return `属性 ${name} 的值无效`
  if (name === 'id') return svgIdValue.test(value) ? null : '品牌 SVG 的 id 无效'
  if (name === 'clip-path' || name === 'mask')
    return brandLogoSvgLocalReference(value) === null
      ? `品牌 SVG 的 ${name} 只允许引用文件内的定义`
      : null
  if (name === 'style') {
    const declarations = value
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
    if (declarations.length !== 1) return '品牌 SVG 的 style 只允许一个安全声明'
    const [property, propertyValue, extra] =
      declarations[0]?.split(':').map((part) => part.trim()) ?? []
    return extra === undefined &&
      property === 'mix-blend-mode' &&
      blendModes.has(propertyValue ?? '')
      ? null
      : '品牌 SVG 的 style 只允许静态 mix-blend-mode'
  }
  if (name === 'version')
    return value === '1.0' || value === '1.1' ? null : '品牌 SVG 的 version 无效'
  if (name === 'viewBox')
    return parseBrandLogoSvgViewBox(value) === null ? '品牌 SVG 的 viewBox 无效' : null
  if (name === 'd') return pathData.test(value) ? null : '品牌 SVG 路径 d 包含不允许的内容'
  if (name === 'points') return numericList.test(value) ? null : `属性 ${name} 包含不允许的内容`
  if (name === 'transform' || name === 'gradientTransform')
    return transformValue.test(value) ? null : `品牌 SVG 的 ${name} 无效`
  if (name === 'fill' || name === 'stroke')
    return colorValue.test(value) || brandLogoSvgLocalReference(value) !== null
      ? null
      : `属性 ${name} 只允许静态颜色或文件内渐变`
  if (name === 'stop-color') return colorValue.test(value) ? null : '品牌 SVG 的 stop-color 无效'
  if (name === 'offset') return isUnitInterval(value) ? null : '品牌 SVG 的 stop offset 无效'
  if (
    name === 'fill-opacity' ||
    name === 'opacity' ||
    name === 'stroke-opacity' ||
    name === 'stop-opacity'
  )
    return isUnitInterval(value) ? null : `品牌 SVG 的 ${name} 无效`
  if (name === 'gradientUnits' || name === 'maskUnits' || name === 'maskContentUnits')
    return value === 'userSpaceOnUse' || value === 'objectBoundingBox'
      ? null
      : `品牌 SVG 的 ${name} 无效`
  if (name === 'clipPathUnits')
    return value === 'userSpaceOnUse' || value === 'objectBoundingBox'
      ? null
      : '品牌 SVG 的 clipPathUnits 无效'
  if (name === 'spreadMethod')
    return value === 'pad' || value === 'reflect' || value === 'repeat'
      ? null
      : '品牌 SVG 的 spreadMethod 无效'
  if (name === 'mask-type')
    return value === 'alpha' || value === 'luminance' ? null : '品牌 SVG 的 mask-type 无效'
  if (name === 'fill-rule' || name === 'clip-rule')
    return value === 'nonzero' || value === 'evenodd' ? null : `品牌 SVG 的 ${name} 无效`
  if (name === 'stroke-linecap')
    return value === 'butt' || value === 'round' || value === 'square'
      ? null
      : '品牌 SVG 的 stroke-linecap 无效'
  if (name === 'stroke-linejoin')
    return value === 'miter' || value === 'round' || value === 'bevel'
      ? null
      : '品牌 SVG 的 stroke-linejoin 无效'
  if (name === 'vector-effect')
    return value === 'none' || value === 'non-scaling-stroke'
      ? null
      : '品牌 SVG 的 vector-effect 无效'
  if (name === 'stroke-dasharray')
    return value === 'none' || numericList.test(value) ? null : '品牌 SVG 的 stroke-dasharray 无效'
  if (name === 'preserveAspectRatio')
    return preserveAspectRatioValue.test(value) ? null : '品牌 SVG 的 preserveAspectRatio 无效'
  if (element === 'svg' && (name === 'width' || name === 'height') && value === '100%') return null
  if (numericAttributes.has(name))
    return numericValue.test(value) ||
      ((element === 'linearGradient' || element === 'radialGradient' || element === 'mask') &&
        percentageValue.test(value))
      ? null
      : `属性 ${name} 必须是有限数值`
  return null
}
