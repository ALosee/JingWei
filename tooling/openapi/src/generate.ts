import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript'

import { createModuleOpenApiDocument, type ModuleOpenApiContract } from './document.js'

export async function generateModuleClientTypes(contract: ModuleOpenApiContract): Promise<string> {
  const document = createModuleOpenApiDocument(contract)
  const ast = await openapiTS(Buffer.from(JSON.stringify(document)), {
    alphabetize: true,
    exportType: true,
    silent: true,
  })
  return COMMENT_HEADER + astToString(ast)
}
