export const userStatuses = ['INVITED', 'ACTIVE', 'DISABLED', 'LOCKED'] as const
export type UserStatus = (typeof userStatuses)[number]
