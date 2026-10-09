import { describe, expect, it } from 'vitest'

import { inspectUiPackageManifest } from './ui-foundation.js'

describe('UI foundation guardrails', () => {
  it.each(['@soybeanjs/ui', '@vean/ui'])(
    'rejects %s while allowing source-level Vean packages',
    (name) => {
      expect(
        inspectUiPackageManifest(
          'packages/platform/ui/package.json',
          JSON.stringify({ dependencies: { [name]: '0.50.0' } }),
        ).map(({ rule }) => rule),
      ).toContain('source-controlled-ui')

      expect(
        inspectUiPackageManifest(
          'packages/platform/ui/package.json',
          JSON.stringify({
            dependencies: {
              '@vean/aria': '0.50.0',
              '@vean/theme': '0.50.0',
            },
          }),
        ),
      ).toEqual([])
    },
  )
})
