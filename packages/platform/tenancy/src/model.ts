import type { TenantId } from '@jingwei/kernel'

export const tenantStatuses = ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'DISABLED'] as const
export type TenantStatus = (typeof tenantStatuses)[number]

export const tenantProvisioningSteps = [
  'TENANT_RESERVED',
  'IAM_INITIALIZED',
  'NAVIGATION_INITIALIZED',
  'COMPLETED',
] as const
export type TenantProvisioningStep = (typeof tenantProvisioningSteps)[number]

export interface TenantSnapshot {
  readonly id: TenantId
  readonly code: string
  readonly name: string
  readonly status: TenantStatus
  readonly defaultLocale: string
  readonly defaultTimezone: string
  readonly defaultCurrency: string
  readonly version: number
  readonly provisioningStep: TenantProvisioningStep
  readonly provisioningErrorCode: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreateTenantInput {
  readonly code: string
  readonly name: string
  readonly defaultLocale: string
  readonly defaultTimezone: string
  readonly defaultCurrency: string
}
