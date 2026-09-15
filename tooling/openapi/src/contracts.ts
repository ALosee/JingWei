import { iamOpenApiContract } from '@jingwei/module-iam/openapi'
import { navigationOpenApiContract } from '@jingwei/module-navigation/openapi'
import { organizationOpenApiContract } from '@jingwei/module-organization/openapi'

/** Explicit registry: generating clients must never discover or execute arbitrary repository files. */
export const openApiContracts = [
  iamOpenApiContract,
  navigationOpenApiContract,
  organizationOpenApiContract,
] as const
