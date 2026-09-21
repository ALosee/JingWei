import { readonly, shallowRef } from 'vue'

import type { PlatformOperator } from '../shared/index.js'

const currentOperator = shallowRef<PlatformOperator | null>(null)

export const platformOperator = readonly(currentOperator)

export function setPlatformOperator(operator: PlatformOperator | null): void {
  currentOperator.value = operator
}
