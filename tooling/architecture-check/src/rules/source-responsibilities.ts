import { posix } from 'node:path'

import ts from 'typescript'

import type { ArchitectureViolation } from '../contracts.js'

const databaseCalls = new Set([
  'selectFrom',
  'insertInto',
  'updateTable',
  'deleteFrom',
  'executeQuery',
])
const httpMethods = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'all',
  'on',
  'use',
  'onError',
  'notFound',
])
const technicalImports =
  /^(?:node:|hono(?:\/|$)|@hono\/|kysely(?:\/|$)|pg$|@jingwei\/(?:database|config|tenancy)(?:\/|$))/u

/** Syntactic guardrails, not a proof of business semantics. Parse TS/Vue scripts to avoid comment/string matches. */
export function inspectSourceResponsibilities(
  file: string,
  content: string,
  options: { entrypoint?: boolean } = {},
): ArchitectureViolation[] {
  const scripts = file.endsWith('.vue')
    ? [...content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gu)]
        .map((match) => match[1] ?? '')
        .join('\n')
    : content
  const source = ts.createSourceFile(file, scripts, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const violations: ArchitectureViolation[] = []
  const report = (rule: string, message: string) => {
    if (!violations.some((violation) => violation.rule === rule && violation.message === message))
      violations.push({ file, rule, message })
  }
  const imports = new Map<string, string>()
  const moduleFile = file.startsWith('packages/modules/')
  const domain = moduleFile && file.includes('/server/domain/')
  const application = moduleFile && file.includes('/server/application/')
  const api = moduleFile && file.includes('/server/api/')
  const apiContract =
    (moduleFile || file.startsWith('packages/platform/control-plane/')) &&
    file.endsWith('/server/api/openapi.ts')
  const page = moduleFile && file.includes('/web/pages/') && file.endsWith('.vue')
  const composition =
    /^apps\/[^/]+\/src\/(?:bootstrap\/|app\.ts$)/u.test(file) ||
    (moduleFile && /\/server\/(?:module\.ts|public\/create-[^/]+\.ts)$/u.test(file)) ||
    file === 'packages/platform/control-plane/src/server/create-control-plane.ts'

  function inspectImport(specifier: string, portableType = false) {
    const target = specifier.startsWith('.')
      ? posix.normalize(posix.join(posix.dirname(file), specifier))
      : specifier
    if (specifier === '@soybeanjs/ui' || specifier.startsWith('@soybeanjs/ui/')) {
      report(
        'source-controlled-ui',
        'Import local components from @jingwei/ui; the styled @soybeanjs/ui package is forbidden',
      )
    }
    if (specifier.startsWith('#ui/') && !file.startsWith('packages/platform/ui/')) {
      report('ui-private-import', 'The #ui alias is private to packages/platform/ui')
    }
    if (file.startsWith('tooling/') && target.startsWith('apps/')) {
      report(
        'tooling-app-boundary',
        'Tooling must consume explicit package exports instead of crossing into an app source tree',
      )
    }
    if (
      (domain || application || api) &&
      ((technicalImports.test(specifier) &&
        !portableType &&
        !(api && /^(?:hono|@hono\/)/u.test(specifier))) ||
        /\/server\/(?:infrastructure\/|module\.js$)/u.test(target))
    ) {
      report(
        'server-layer-boundary',
        'Domain/Application/API must not import persistence or composition details: ' + specifier,
      )
    }
    if (
      (domain && /\/server\/(?:application|api|public)\//u.test(target)) ||
      (application && target.includes('/server/api/'))
    ) {
      report(
        'server-layer-boundary',
        'Dependency points outwards from its server layer: ' + specifier,
      )
    }
    if (page && /(?:\/client(?:\/|$)|@jingwei\/api-client(?:\/|$))/u.test(target)) {
      report(
        'page-workflow-boundary',
        'Page must delegate HTTP workflow/state to a module composable: ' + specifier,
      )
    }
  }

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text
      const bindings = statement.importClause?.namedBindings
      // Deliberate platform ports may be consumed as types without admitting concrete DB/runtime classes.
      const portableNames =
        specifier === '@jingwei/tenancy'
          ? new Set(['TenantDirectory', 'ActiveTenantSnapshot'])
          : specifier === '@jingwei/config'
            ? new Set(['AppConfig'])
            : new Set<string>()
      const portableType =
        !domain &&
        statement.importClause?.name === undefined &&
        bindings !== undefined &&
        ts.isNamedImports(bindings) &&
        bindings.elements.length > 0 &&
        bindings.elements.every(
          (binding) =>
            (statement.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword ||
              binding.isTypeOnly) &&
            portableNames.has(binding.propertyName?.text ?? binding.name.text),
        )
      inspectImport(specifier, portableType)
      if (statement.importClause?.name) imports.set(statement.importClause.name.text, specifier)
      if (bindings && ts.isNamedImports(bindings))
        for (const binding of bindings.elements) {
          imports.set(binding.name.text, specifier)
          const importedName = binding.propertyName?.text ?? binding.name.text
          if (
            (importedName === 'platformAuthenticatedApiAccess' ||
              importedName === 'platformRefreshTokenApiAccess') &&
            !file.startsWith('packages/platform/control-plane/') &&
            !file.startsWith('packages/platform/module-sdk/')
          ) {
            report(
              'platform-authorization-boundary',
              'Platform authorization contracts are owned by the control-plane package',
            )
          }
          if (apiContract && specifier === '@hono/zod-openapi' && importedName === 'createRoute') {
            report(
              'api-authorization-contract',
              'Module OpenAPI routes must use createApiRoute and declare authorization metadata',
            )
          }
        }
      if (bindings && ts.isNamespaceImport(bindings)) imports.set(bindings.name.text, specifier)
    }
  }
  if (options.entrypoint) {
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement)) {
        const specifier = ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : ''
        const prefix = file.startsWith('apps/') ? './bootstrap/' : './commands/'
        if (!specifier.startsWith(prefix))
          report('thin-entrypoint', 'Executable entry imports only its bootstrap/command boundary')
        continue
      }
      const expression = ts.isExpressionStatement(statement) ? statement.expression : undefined
      const call =
        expression && ts.isAwaitExpression(expression) ? expression.expression : expression
      if (
        !call ||
        !ts.isCallExpression(call) ||
        !ts.isIdentifier(call.expression) ||
        !imports.has(call.expression.text) ||
        call.arguments.length > 0
      ) {
        report(
          'thin-entrypoint',
          'Executable entry contains only imports and calls to imported startup functions; no inline workflow',
        )
      }
    }
  }

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const method = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text
        : null
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')
      ) {
        const argument = node.arguments[0]
        if (argument && ts.isStringLiteral(argument)) inspectImport(argument.text)
      }
      if (
        (composition || domain || application || api) &&
        method !== null &&
        databaseCalls.has(method)
      ) {
        report(
          'no-persistence-in-orchestration',
          'SQL execution belongs to an owner infrastructure adapter',
        )
      }
      if (
        composition &&
        method !== null &&
        httpMethods.has(method) &&
        node.arguments.some(
          (argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument),
        )
      ) {
        report(
          'composition-no-handlers',
          'Composition registers imported routes/middleware, not inline handlers',
        )
      }
      const callee = ts.isIdentifier(node.expression) ? node.expression.text : ''
      const receiver =
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression)
          ? node.expression.expression.text
          : ''
      if (
        apiContract &&
        method === 'createRoute' &&
        imports.get(receiver) === '@hono/zod-openapi'
      ) {
        report(
          'api-authorization-contract',
          'Module OpenAPI routes must use createApiRoute and declare authorization metadata',
        )
      }
      if (
        (page || composition) &&
        (callee === 'fetch' ||
          (receiver === 'globalThis' && method === 'fetch') ||
          /\/client(?:\/|$)/u.test(imports.get(callee) ?? imports.get(receiver) ?? ''))
      ) {
        report(
          'workflow-outside-boundary',
          'HTTP workflow belongs to a feature controller/use case, not a page or composition root',
        )
      }
    }
    if (
      moduleFile &&
      ts.isPropertyAccessExpression(node) &&
      node.getText(source) === 'process.env'
    ) {
      report(
        'module-no-process-env',
        'Module runtime receives configuration through explicit injection',
      )
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return violations
}
