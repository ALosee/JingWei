import { readonly, shallowRef } from 'vue'

import { defaultEffectiveBrand, type EffectiveBrand } from '../shared/index.js'

const currentBrand = shallowRef<EffectiveBrand>(defaultEffectiveBrand)

export const activeBrand = readonly(currentBrand)

export function setActiveBrand(brand: EffectiveBrand): void {
  currentBrand.value = brand
}

export function useActiveBrand() {
  return activeBrand
}
