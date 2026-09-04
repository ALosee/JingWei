import { describe, expect, it } from 'vitest'

import { inspectSourceResponsibilities } from './source-responsibilities.js'

const codes = (file: string, source: string, entrypoint = false) =>
  inspectSourceResponsibilities(file, source, { entrypoint }).map((violation) => violation.rule)

describe('source responsibility guardrails', () => {
  it('accepts thin Web/Server/CLI entries but rejects inline workflow and callback wrappers', () => {
    expect(
      codes(
        'apps/web/src/main.ts',
        "import { start } from './bootstrap/start.js'; await start()",
        true,
      ),
    ).toEqual([])
    expect(
      codes(
        'tooling/migration/src/seed-dev.ts',
        "import { run } from './commands/seed.js'; await run()",
        true,
      ),
    ).toEqual([])
    for (const source of [
      "import { getNavigation } from '@jingwei/module-navigation/client'; await getNavigation()",
      "import { start } from './bootstrap/start.js'; try { await start() } catch {}",
      "import { start } from './bootstrap/start.js'; await start(() => fetch('/api'))",
      'const start = () => {}; start()',
    ])
      expect(codes('apps/web/src/main.ts', source, true)).toContain('thin-entrypoint')
  })
  it('prevents relocating business HTTP/SQL work into a composition root', () => {
    const file = 'apps/server/src/app.ts'
    expect(codes(file, "app.route('/api', createRoutes(useCase))")).toEqual([])
    expect(
      codes(
        file,
        "app.get('/api', async (c) => c.json(await db.selectFrom('iam.user').execute()))",
      ),
    ).toEqual(
      expect.arrayContaining(['composition-no-handlers', 'no-persistence-in-orchestration']),
    )
    expect(
      codes(file, 'app.onError((error, context) => context.json({ error: error.message }, 500))'),
    ).toContain('composition-no-handlers')
    expect(codes(file, "app.notFound((context) => context.text('Not found', 404))")).toContain(
      'composition-no-handlers',
    )
    expect(
      codes(
        'apps/web/src/bootstrap/start-web.ts',
        "import { load } from '@jingwei/module-navigation/client'; await load()",
      ),
    ).toContain('workflow-outside-boundary')
    expect(
      codes(
        'apps/web/src/bootstrap/start-web.ts',
        "import * as api from '@jingwei/module-navigation/client'; await api.load()",
      ),
    ).toContain('workflow-outside-boundary')
  })
  it('rejects outward layer dependencies, including relative and literal dynamic imports', () => {
    expect(
      codes(
        'packages/modules/iam/src/server/application/example.ts',
        "import { Repo } from '../infrastructure/repo.js'",
      ),
    ).toContain('server-layer-boundary')
    expect(
      codes('packages/modules/iam/src/server/domain/example.ts', "const api = import('hono')"),
    ).toContain('server-layer-boundary')
    expect(
      codes(
        'packages/modules/iam/src/server/api/routes.ts',
        "import { Hono } from 'hono'; import type { UseCase } from '../application/use-case.js'",
      ),
    ).toEqual([])
    expect(
      codes(
        'packages/modules/iam/src/server/application/example.ts',
        "import type { AuthContext } from '@jingwei/kernel'",
      ),
    ).toEqual([])
    expect(
      codes(
        'packages/modules/iam/src/server/application/example.ts',
        "import type { TenantDirectory } from '@jingwei/database'",
      ),
    ).toEqual([])
    expect(
      codes(
        'packages/modules/iam/src/server/application/example.ts',
        "import type { DatabaseRuntime } from '@jingwei/database'",
      ),
    ).toContain('server-layer-boundary')
    expect(
      codes(
        'packages/modules/iam/src/server/application/example.ts',
        "import runtime, { type TenantDirectory } from '@jingwei/database'",
      ),
    ).toContain('server-layer-boundary')
  })
  it('keeps page workflow out of Vue scripts without matching markup, comments or strings', () => {
    const file = 'packages/modules/iam/src/web/pages/IamLogin.vue'
    expect(
      codes(file, '<script setup lang="ts">import { login } from "../../client/index.js"</script>'),
    ).toContain('page-workflow-boundary')
    expect(
      codes(
        file,
        '<script setup lang="ts">const text = "fetch()"; /* process.env */</script><template>fetch()</template>',
      ),
    ).toEqual([])
    expect(
      codes(
        file,
        '<script setup lang="ts">import { useSignIn } from "../composables/use-sign-in.js"; useSignIn()</script>',
      ),
    ).toEqual([])
    expect(codes(file, '<script setup>process.env.DATABASE_URL</script>')).toContain(
      'module-no-process-env',
    )
  })
  it('does not confuse public package index implementations with executable entries', () => {
    expect(
      codes(
        'packages/platform/config/src/index.ts',
        'export function loadConfig(input: unknown) { return input }',
      ),
    ).toEqual([])
  })
})
