import { controlPlaneOpenApiContract } from '@jingwei/control-plane/openapi'
import { brandingOpenApiContract } from '@jingwei/module-branding/openapi'
import { dictionaryOpenApiContract } from '@jingwei/module-dictionary/openapi'
import { iamOpenApiContract } from '@jingwei/module-iam/openapi'
import { navigationOpenApiContract } from '@jingwei/module-navigation/openapi'
import { organizationOpenApiContract } from '@jingwei/module-organization/openapi'

/** Explicit registry: generating clients must never discover or execute arbitrary repository files. */
export const openApiContracts = [
  controlPlaneOpenApiContract,
  brandingOpenApiContract,
  dictionaryOpenApiContract,
  iamOpenApiContract,
  navigationOpenApiContract,
  organizationOpenApiContract,
] as const
