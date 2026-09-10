import { describe, expect, it } from 'vitest'

import { inspectUiPackageManifest } from './ui-foundation.js'

describe('UI foundation guardrails', () => {
  it('rejects @soybeanjs/ui while allowing source-level Soybean packages', () => {
    expect(
      inspectUiPackageManifest(
        'packages/platform/ui/package.json',
        JSON.stringify({ dependencies: { '@soybeanjs/ui': '0.30.0' } }),
      ).map(({ rule }) => rule),
    ).toContain('source-controlled-ui')

    expect(
      inspectUiPackageManifest(
        'packages/platform/ui/package.json',
        JSON.stringify({
          dependencies: {
            '@soybeanjs/headless': '0.30.0',
            '@soybeanjs/theme': '0.30.0',
          },
        }),
      ),
    ).toEqual([])
  })
})
