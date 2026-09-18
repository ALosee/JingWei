import * as organizationFoundation from './20260901020100_organization_foundation.js'
import * as organizationMembershipPrimary from './20260916090001_organization_membership_primary.js'

export const migrations = {
  '20260901020100_organization_foundation': organizationFoundation,
  '20260916090001_organization_membership_primary': organizationMembershipPrimary,
} as const
