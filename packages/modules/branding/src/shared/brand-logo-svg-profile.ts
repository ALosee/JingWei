export const brandLogoSvgProfileVersion = 'BRAND_LOGO_SVG_V1' as const
export const brandLogoSvgNamespace = 'http://www.w3.org/2000/svg'
export const maximumBrandAssetBytes = 512 * 1024
export const maximumBrandLogoSvgDepth = 32
export const maximumBrandLogoSvgElements = 256
export const maximumBrandLogoSvgAttributesPerElement = 32
export const minimumBrandLogoAspectRatio = 1
export const maximumBrandLogoAspectRatio = 12

export const brandLogoSvgElements = [
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
] as const

export type BrandLogoSvgElement = (typeof brandLogoSvgElements)[number]

const elementNames = new Set<string>(brandLogoSvgElements)
const commonAttributes = new Set([
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
  'transform',
  'vector-effect',
])
const elementAttributes: Record<BrandLogoSvgElement, ReadonlySet<string>> = {
  svg: new Set(['height', 'preserveAspectRatio', 'viewBox', 'width', 'x', 'y']),
  g: new Set(),
  path: new Set(['d']),
  rect: new Set(['height', 'rx', 'ry', 'width', 'x', 'y']),
  circle: new Set(['cx', 'cy', 'r']),
  ellipse: new Set(['cx', 'cy', 'rx', 'ry']),
  line: new Set(['x1', 'x2', 'y1', 'y2']),
  polyline: new Set(['points']),
  polygon: new Set(['points']),
}

const numericAttributes = new Set([
  'cx',
  'cy',
  'fill-opacity',
  'height',
  'opacity',
  'r',
  'rx',
  'ry',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'width',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
])
const numericValue = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:px)?$/i
const numericList = /^[\s,+\-.\dEe]+$/
const pathData = /^[\s,+\-.\dEeMmZzLlHhVvCcSsQqTtAa]+$/
const transformValue = /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\([\s,+\-.\dEe]+\)\s*)+$/
const colorValue =
  /^(?:none|currentColor|transparent|#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|[a-z]+|(?:rgb|rgba|hsl|hsla)\([\s,%+\-.\d]+\))$/i
const preserveAspectRatioValue = /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:\s+(?:meet|slice))?)$/

export interface BrandLogoSvgViewBox {
  readonly minX: number
  readonly minY: number
  readonly width: number
  readonly height: number
}

export function isBrandLogoSvgElement(value: string): value is BrandLogoSvgElement {
  return elementNames.has(value)
}

export function hasValidBrandLogoAspectRatio(width: number, height: number): boolean {
  const ratio = width / height
  return ratio >= minimumBrandLogoAspectRatio && ratio <= maximumBrandLogoAspectRatio
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

/** Returns a user-facing reason when an attribute is outside the Logo SVG V1 profile. */
export function validateBrandLogoSvgAttribute(
  element: BrandLogoSvgElement,
  name: string,
  value: string,
): string | null {
  if (!commonAttributes.has(name) && !elementAttributes[element].has(name))
    return `元素 <${element}> 不允许属性 ${name}`
  if (name.startsWith('on')) return `Logo SVG 不允许事件属性 ${name}`
  if (value.length === 0 || value.length > 100_000) return `属性 ${name} 的值无效`
  if (name === 'viewBox')
    return parseBrandLogoSvgViewBox(value) === null ? 'Logo SVG 的 viewBox 无效' : null
  if (name === 'd') return pathData.test(value) ? null : 'Logo SVG 路径 d 包含不允许的内容'
  if (name === 'points') return numericList.test(value) ? null : `属性 ${name} 包含不允许的内容`
  if (name === 'transform') return transformValue.test(value) ? null : 'Logo SVG 的 transform 无效'
  if (name === 'fill' || name === 'stroke')
    return colorValue.test(value) ? null : `属性 ${name} 只允许静态颜色、none 或 currentColor`
  if (name === 'fill-rule' || name === 'clip-rule')
    return value === 'nonzero' || value === 'evenodd' ? null : `Logo SVG 的 ${name} 无效`
  if (name === 'stroke-linecap')
    return value === 'butt' || value === 'round' || value === 'square'
      ? null
      : 'Logo SVG 的 stroke-linecap 无效'
  if (name === 'stroke-linejoin')
    return value === 'miter' || value === 'round' || value === 'bevel'
      ? null
      : 'Logo SVG 的 stroke-linejoin 无效'
  if (name === 'vector-effect')
    return value === 'none' || value === 'non-scaling-stroke'
      ? null
      : 'Logo SVG 的 vector-effect 无效'
  if (name === 'stroke-dasharray')
    return value === 'none' || numericList.test(value) ? null : 'Logo SVG 的 stroke-dasharray 无效'
  if (name === 'preserveAspectRatio')
    return preserveAspectRatioValue.test(value) ? null : 'Logo SVG 的 preserveAspectRatio 无效'
  if (numericAttributes.has(name))
    return numericValue.test(value) ? null : `属性 ${name} 必须是有限数值`
  return null
}
