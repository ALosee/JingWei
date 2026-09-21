import { openApiContracts } from '../contracts.js'
import { generateModuleClientTypes } from '../generate.js'
import { checkModuleClientTypes, writeModuleClientTypes } from '../write.js'

export async function generateOpenApiClients(
  rootDirectory: string,
  check: boolean,
): Promise<readonly string[]> {
  const destinations: string[] = []
  for (const contract of openApiContracts) {
    const source = await generateModuleClientTypes(contract)
    destinations.push(
      await (check ? checkModuleClientTypes : writeModuleClientTypes)({
        rootDirectory,
        moduleId: contract.id,
        ...('clientOutput' in contract ? { clientOutput: contract.clientOutput } : {}),
        source,
      }),
    )
  }
  return destinations
}

export async function runGenerateOpenApiCommand(): Promise<void> {
  const check = process.argv.slice(2).includes('--check')
  const destinations = await generateOpenApiClients(process.cwd(), check)
  for (const destination of destinations)
    console.log(`${check ? 'verified' : 'generated'} ${destination}`)
}
