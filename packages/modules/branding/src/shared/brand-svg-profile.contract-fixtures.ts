import type { BrandSvgPurpose } from './brand-logo-svg-profile.js'

export interface BrandSvgProfileContractFixture {
  readonly name: string
  readonly purpose: BrandSvgPurpose
  readonly source: string
  readonly expected: 'ACCEPT' | 'REJECT'
}

/** Shared corpus that keeps the authoritative server parser and browser preflight aligned. */
export const brandSvgProfileContractFixtures = [
  {
    name: 'minimal horizontal logo',
    purpose: 'LOGO',
    source:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 24"><path d="M0 0h140v24H0z" fill="currentColor"/></svg>',
    expected: 'ACCEPT',
  },
  {
    name: 'design-tool square mark with an internal clip path',
    purpose: 'MARK',
    source: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
      version="1.1" viewBox="0 0 36 36" width="100%" height="100%">
      <defs><clipPath id="mark_clip"><rect width="36" height="36" rx="8"/></clipPath></defs>
      <g clip-path="url(#mark_clip)">
        <path d="M4 4h28v28H4z" fill="#A71E32" style="mix-blend-mode:passthrough"/>
      </g>
    </svg>`,
    expected: 'ACCEPT',
  },
  {
    name: 'large square viewBox uses vector coordinates rather than pixel dimensions',
    purpose: 'MARK',
    source:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10000 10000"><path d="M0 0h1v1z"/></svg>',
    expected: 'ACCEPT',
  },
  {
    name: 'static gradients masks descriptions and comments from design tools',
    purpose: 'MARK',
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <!-- exported brand mark --><title>Example mark</title><desc>Static vector artwork</desc>
      <defs>
        <linearGradient id="brand_gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#A71E32"/>
          <stop offset="1" stop-color="#111827" stop-opacity="0.9"/>
        </linearGradient>
        <mask id="brand_mask" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <circle cx="32" cy="32" r="30" fill="white"/>
        </mask>
      </defs>
      <rect width="64" height="64" fill="url(#brand_gradient)" mask="url(#brand_mask)"/>
    </svg>`,
    expected: 'ACCEPT',
  },
  {
    name: 'mark must use a square viewBox',
    purpose: 'MARK',
    source:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32"><path d="M0 0h1v1z"/></svg>',
    expected: 'REJECT',
  },
  {
    name: 'horizontal logo rejects an impractical aspect ratio',
    purpose: 'LOGO',
    source:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 24"><path d="M0 0h2000v24H0z"/></svg>',
    expected: 'REJECT',
  },
  {
    name: 'style cannot load an external resource',
    purpose: 'MARK',
    source:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M0 0h36v36H0z" style="fill:url(https://example.com/a.svg)"/></svg>',
    expected: 'REJECT',
  },
  {
    name: 'clip path reference must resolve inside the document',
    purpose: 'MARK',
    source:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path clip-path="url(#missing)" d="M0 0h36v36H0z"/></svg>',
    expected: 'REJECT',
  },
  {
    name: 'clip path cannot reference an external resource',
    purpose: 'MARK',
    source:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path clip-path="url(https://example.com/a.svg#clip)" d="M0 0h36v36H0z"/></svg>',
    expected: 'REJECT',
  },
  {
    name: 'paint cannot reference an external gradient',
    purpose: 'MARK',
    source:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="url(https://example.com/a.svg#paint)" d="M0 0h36v36H0z"/></svg>',
    expected: 'REJECT',
  },
  {
    name: 'paint reference must resolve to a gradient',
    purpose: 'MARK',
    source:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><defs><clipPath id="paint"><rect width="36" height="36"/></clipPath></defs><path fill="url(#paint)" d="M0 0h36v36H0z"/></svg>',
    expected: 'REJECT',
  },
  {
    name: 'xlink namespace declaration does not enable xlink attributes',
    purpose: 'MARK',
    source:
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 36 36"><g xlink:href="https://example.com/a.svg"><path d="M0 0h1v1z"/></g></svg>',
    expected: 'REJECT',
  },
  {
    name: 'doctype and entity declarations remain forbidden',
    purpose: 'MARK',
    source:
      '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M0 0h1v1z"/></svg>',
    expected: 'REJECT',
  },
] as const satisfies readonly BrandSvgProfileContractFixture[]
