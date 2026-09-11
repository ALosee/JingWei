import { shallowRef } from 'vue'

import type { AuthenticatedUser } from '../shared/index.js'

/** Live display projection shared by shell chrome and the account page. */
export const iamSessionUser = shallowRef<AuthenticatedUser | null>(null)

export function setIamSessionUser(user: AuthenticatedUser | null): void {
  iamSessionUser.value = user
}

export function patchIamSessionUser(input: {
  displayName?: string
  avatarUrl?: string | null
}): void {
  const current = iamSessionUser.value
  if (current === null) return
  iamSessionUser.value = {
    ...current,
    ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    ...(input.avatarUrl === undefined ? {} : { avatarUrl: input.avatarUrl }),
  }
}
