import {
  brandLogoSvgNamespace,
  hasValidBrandLogoAspectRatio,
  isBrandLogoSvgElement,
  maximumBrandLogoSvgAttributesPerElement,
  maximumBrandLogoSvgDepth,
  maximumBrandLogoSvgElements,
  parseBrandLogoSvgViewBox,
  validateBrandLogoSvgAttribute,
} from '../shared/index.js'

function fail(message: string): never {
  throw new Error(`Logo SVG 校验失败：${message}`)
}

/** Browser-side defense before upload; the server remains the authoritative security boundary. */
export function validateBrandLogoSvgText(source: string): void {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  if (document.getElementsByTagName('parsererror').length > 0) fail('XML 结构无效')
  const root = document.documentElement
  if (root.namespaceURI !== brandLogoSvgNamespace || root.localName !== 'svg')
    fail('根元素必须是 SVG 命名空间中的 <svg>')
  for (const child of Array.from(document.childNodes)) {
    if (child !== root) fail('根元素之外不允许 DOCTYPE、注释或处理指令')
  }

  let elements = 0
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
        if (
          element !== root ||
          attribute.name !== 'xmlns' ||
          attribute.value !== brandLogoSvgNamespace
        )
          fail('不允许额外的 XML 命名空间')
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
    }

    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) visit(child as Element, depth + 1)
      else if (child.nodeType !== Node.TEXT_NODE || child.textContent?.trim() !== '')
        fail('只允许图形元素和空白文本')
    }
  }

  visit(root, 1)
  const viewBox = parseBrandLogoSvgViewBox(root.getAttribute('viewBox') ?? '')
  if (viewBox === null) fail('必须包含有效的 viewBox')
  if (!hasValidBrandLogoAspectRatio(viewBox.width, viewBox.height))
    fail('横向 Logo 宽高比必须在 1:1 至 12:1 之间')
}
