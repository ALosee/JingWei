import { onMounted, watch } from 'vue'

import { useIamPermission } from '@jingwei/module-iam/session'

import { useDictionaryCatalog } from './use-dictionary-catalog.js'
import { useDictionaryFeedback } from './use-dictionary-feedback.js'
import { useDictionaryItems } from './use-dictionary-items.js'

/** Assembles independently owned catalog, item and feedback state for the management page. */
export function useDictionaryManagement() {
  const feedback = useDictionaryFeedback()
  const catalog = useDictionaryCatalog(feedback)
  const items = useDictionaryItems(catalog.selectedTypeId, feedback, catalog.adoptDetail)
  const canManage = useIamPermission('dictionary.manage')

  function typeIdsInCategory(categoryId: string) {
    return catalog.types.value
      .filter((type) => type.categoryId === categoryId)
      .map((type) => type.id)
  }

  // Warm type details as soon as a category is chosen so the first type click is instant.
  // onMounted does not prefetch again: catalog.load() selecting the first category already
  // triggers this watch, and a second call would race the same in-flight request.
  watch(
    () => catalog.selectedCategoryId.value,
    (categoryId) => {
      if (categoryId === '') return
      void items.prefetch(typeIdsInCategory(categoryId))
    },
  )

  onMounted(() => {
    void (async () => {
      await catalog.load()
      await items.load()
    })()
  })

  return { feedback, catalog, items, canManage }
}
