import { computed, shallowRef, type ComputedRef } from 'vue'

/** Live effective permission codes for the authenticated session; UX only, not a security boundary. */
export const iamSessionPermissions = shallowRef<ReadonlySet<string>>(new Set())

export function setIamSessionPermissions(codes: readonly string[]): void {
  iamSessionPermissions.value = new Set(codes)
}

export function clearIamSessionPermissions(): void {
  iamSessionPermissions.value = new Set()
}

export function hasIamPermission(code: string): boolean {
  return iamSessionPermissions.value.has(code)
}

export function useIamPermission(code: string): ComputedRef<boolean> {
  return computed(() => iamSessionPermissions.value.has(code))
}
