import {
  brandLogoSvgLocalReference,
  brandLogoSvgNamespace,
  brandLogoSvgXlinkNamespace,
  brandSvgGeometryViolation,
  isBrandLogoSvgElement,
  maximumBrandLogoSvgAttributesPerElement,
  maximumBrandLogoSvgDepth,
  maximumBrandLogoSvgElements,
  parseBrandLogoSvgViewBox,
  validateBrandLogoSvgAttribute,
  type BrandSvgPurpose,
} from '../shared/index.js'

function fail(message: string): never {
  throw new Error(`品牌 SVG 校验失败：${message}`)
}

/** Browser-side defense before upload; the server remains the authoritative security boundary. */
export function validateBrandSvgText(source: string, purpose: BrandSvgPurpose): void {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  if (document.getElementsByTagName('parsererror').length > 0) fail('XML 结构无效')
  const root = document.documentElement
  if (root.namespaceURI !== brandLogoSvgNamespace || root.localName !== 'svg')
    fail('根元素必须是 SVG 命名空间中的 <svg>')
  for (const child of Array.from(document.childNodes)) {
    if (
      child !== root &&
      child.nodeType !== Node.COMMENT_NODE &&
      (child.nodeType !== Node.TEXT_NODE || child.textContent?.trim() !== '')
    )
      fail('根元素之外不允许 DOCTYPE 或处理指令')
  }

  let elements = 0
  let descriptiveTextLength = 0
  const definitions = new Map<string, 'CLIP_PATH' | 'GRADIENT' | 'MASK'>()
  const references: { id: string; expected: 'CLIP_PATH' | 'GRADIENT' | 'MASK'; label: string }[] =
    []
  const visit = (element: Element, depth: number): void => {
    elements++
    if (depth > maximumBrandLogoSvgDepth) fail(`嵌套不能超过 ${maximumBrandLogoSvgDepth} 层`)
    if (elements > maximumBrandLogoSvgElements)
      fail(`图形元素不能超过 ${maximumBrandLogoSvgElements} 个`)
    if (element.namespaceURI !== brandLogoSvgNamespace || !isBrandLogoSvgElement(element.localName))
      fail(`不允许元素 <${element.tagName}>`)
    if (element !== root && element.localName === 'svg') fail('不允许嵌套 <svg>')
    if (element.attributes.length > maximumBrandLogoSvgAttributesPerElement)
      fail(`每个元素最多允许 ${maximumBrandLogoSvgAttributesPerElement} 个属性`)

    for (const attribute of Array.from(element.attributes)) {
      if (attribute.namespaceURI === 'http://www.w3.org/2000/xmlns/') {
        const primaryNamespace =
          element === root &&
          attribute.name === 'xmlns' &&
          attribute.value === brandLogoSvgNamespace
        const unusedXlinkNamespace =
          element === root &&
          attribute.name === 'xmlns:xlink' &&
          attribute.value === brandLogoSvgXlinkNamespace
        if (!primaryNamespace && !unusedXlinkNamespace) fail('不允许额外的 XML 命名空间')
        continue
      }
      if (attribute.namespaceURI !== null || attribute.prefix !== null)
        fail(`不允许命名空间属性 ${attribute.name}`)
      const reason = validateBrandLogoSvgAttribute(
        element.localName,
        attribute.localName,
        attribute.value,
      )
      if (reason !== null) fail(reason)
      if (
        attribute.localName === 'id' &&
        (element.localName === 'clipPath' ||
          element.localName === 'linearGradient' ||
          element.localName === 'radialGradient' ||
          element.localName === 'mask')
      ) {
        if (definitions.has(attribute.value)) fail(`id ${attribute.value} 重复`)
        definitions.set(
          attribute.value,
          element.localName === 'clipPath'
            ? 'CLIP_PATH'
            : element.localName === 'mask'
              ? 'MASK'
              : 'GRADIENT',
        )
      }
      if (
        attribute.localName === 'clip-path' ||
        attribute.localName === 'mask' ||
        attribute.localName === 'fill' ||
        attribute.localName === 'stroke'
      ) {
        const reference = brandLogoSvgLocalReference(attribute.value)
        if (reference !== null)
          references.push({
            id: reference,
            expected:
              attribute.localName === 'clip-path'
                ? 'CLIP_PATH'
                : attribute.localName === 'mask'
                  ? 'MASK'
                  : 'GRADIENT',
            label: attribute.localName,
          })
      }
    }

    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (element.localName === 'title' || element.localName === 'desc')
          fail(`<${element.localName}> 只能包含文本`)
        visit(child as Element, depth + 1)
      } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim() !== '') {
        if (element.localName !== 'title' && element.localName !== 'desc')
          fail('只允许 title/desc 中的说明文本')
        descriptiveTextLength += child.textContent?.length ?? 0
        if (descriptiveTextLength > 1024) fail('说明文本不能超过 1024 个字符')
      } else if (child.nodeType !== Node.TEXT_NODE && child.nodeType !== Node.COMMENT_NODE) {
        fail('只允许静态图形、说明文本和注释')
      }
    }
  }

  visit(root, 1)
  for (const reference of references) {
    if (definitions.get(reference.id) !== reference.expected)
      fail(`${reference.label} 引用了不存在或类型不匹配的定义 #${reference.id}`)
  }
  const viewBox = parseBrandLogoSvgViewBox(root.getAttribute('viewBox') ?? '')
  if (viewBox === null) fail('必须包含有效的 viewBox')
  const geometryViolation = brandSvgGeometryViolation(purpose, viewBox)
  if (geometryViolation !== null) fail(geometryViolation)
}
