export const organizationTypes = ['COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM', 'OTHER'] as const
export type OrganizationType = (typeof organizationTypes)[number]
