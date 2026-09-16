import { inject, type InjectionKey } from 'vue'

import type { ApiRequestOptions } from '@jingwei/api-client'

export interface CustomScopeReferenceOption {
  readonly id: string
  readonly parentId: string | null
  readonly code: string
  readonly name: string
  readonly depth: number
}

/** UI-only directory for the current Edition's CUSTOM data-scope reference provider. */
export interface CustomScopeReferenceDirectory {
  load(options?: ApiRequestOptions): Promise<readonly CustomScopeReferenceOption[]>
}

export const customScopeReferenceDirectoryKey: InjectionKey<CustomScopeReferenceDirectory> = Symbol(
  'iam-custom-scope-reference-directory',
)

export function useCustomScopeReferenceDirectory(): CustomScopeReferenceDirectory | null {
  return inject(customScopeReferenceDirectoryKey, null)
}
