import { computed, ref } from 'vue'

import * as api from '../../client/index.js'
import {
  compareDictionaryCategories,
  type CreateDictionaryCategory,
  type CreateDictionaryType,
  type DictionaryCategory,
  type DictionaryType,
  type DictionaryTypeDetail,
  type UpdateDictionaryCategory,
  type UpdateDictionaryType,
} from '../../shared/index.js'
import type { useDictionaryFeedback } from './use-dictionary-feedback.js'

type DictionaryFeedback = ReturnType<typeof useDictionaryFeedback>

export function useDictionaryCatalog(feedback: DictionaryFeedback) {
  const categories = ref<DictionaryCategory[]>([])
  const types = ref<DictionaryType[]>([])
  const selectedKind = ref<'category' | 'type' | null>(null)
  const selectedCategoryId = ref('')
  const selectedTypeId = ref('')
  const search = ref('')

  const selectedCategory = computed(() =>
    categories.value.find((category) => category.id === selectedCategoryId.value),
  )
  const selectedType = computed(() => types.value.find((type) => type.id === selectedTypeId.value))

  const groups = computed(() => {
    const query = search.value.trim().toLocaleLowerCase()
    return categories.value.toSorted(compareDictionaryCategories).flatMap((category) => {
      const categoryMatches = `${category.name} ${category.code}`
        .toLocaleLowerCase()
        .includes(query)
      const categoryTypes = types.value
        .filter((type) => type.categoryId === category.id)
        .filter(
          (type) =>
            query === '' ||
            categoryMatches ||
            `${type.name} ${type.code}`.toLocaleLowerCase().includes(query),
        )
        .toSorted(
          (left, right) =>
            left.name.localeCompare(right.name) || left.code.localeCompare(right.code),
        )
      if (query !== '' && !categoryMatches && categoryTypes.length === 0) return []
      return [{ category, types: categoryTypes }]
    })
  })

  async function load() {
    await feedback.run(async () => {
      const result = await api.getDictionaryCatalog()
      if (result.error !== null) throw result.error
      categories.value = result.data.categories
      types.value = result.data.types
      if (selectedKind.value === 'type') {
        const selected = types.value.find((type) => type.id === selectedTypeId.value)
        if (selected !== undefined) {
          selectedCategoryId.value = selected.categoryId
          return
        }
      }
      if (
        selectedKind.value === 'category' &&
        categories.value.some((category) => category.id === selectedCategoryId.value)
      ) {
        selectedTypeId.value = ''
        return
      }
      const firstCategory = categories.value.toSorted(compareDictionaryCategories)[0]
      if (firstCategory === undefined) {
        selectedKind.value = null
        selectedCategoryId.value = ''
        selectedTypeId.value = ''
      } else {
        selectCategory(firstCategory.id)
      }
    })
  }

  function selectCategory(id: string) {
    if (!categories.value.some((category) => category.id === id)) return
    selectedKind.value = 'category'
    selectedCategoryId.value = id
    selectedTypeId.value = ''
  }

  function selectType(id: string) {
    const selected = types.value.find((type) => type.id === id)
    if (selected === undefined) return
    selectedKind.value = 'type'
    selectedCategoryId.value = selected.categoryId
    selectedTypeId.value = id
  }

  function replaceType(type: DictionaryType) {
    const existing = types.value.some((item) => item.id === type.id)
    types.value = existing
      ? types.value.map((item) => (item.id === type.id ? type : item))
      : [...types.value, type]
    if (selectedKind.value === 'type' && selectedTypeId.value === type.id)
      selectedCategoryId.value = type.categoryId
  }

  async function createCategory(input: CreateDictionaryCategory) {
    return feedback.run(async () => {
      const result = await api.createDictionaryCategory(input)
      if (result.error !== null) throw result.error
      categories.value = [...categories.value, result.data]
      selectCategory(result.data.id)
      return result.data
    })
  }

  async function updateCategory(id: string, input: UpdateDictionaryCategory) {
    return feedback.run(async () => {
      const result = await api.updateDictionaryCategory(id, input)
      if (result.error !== null) throw result.error
      categories.value = categories.value.map((category) =>
        category.id === id ? result.data : category,
      )
      return result.data
    })
  }

  async function deleteCategory(id: string, expectedRevision: number) {
    return feedback.run(async () => {
      const result = await api.deleteDictionaryCategory(id, expectedRevision)
      if (result.error !== null) throw result.error
      categories.value = categories.value.filter((category) => category.id !== id)
      if (selectedKind.value === 'category' && selectedCategoryId.value === id) {
        const firstCategory = categories.value.toSorted(compareDictionaryCategories)[0]
        if (firstCategory === undefined) {
          selectedKind.value = null
          selectedCategoryId.value = ''
        } else {
          selectCategory(firstCategory.id)
        }
      }
      return result.data
    })
  }

  async function createType(input: CreateDictionaryType) {
    return feedback.run(async () => {
      const result = await api.createDictionaryType(input)
      if (result.error !== null) throw result.error
      replaceType(result.data.type)
      selectType(result.data.type.id)
      return result.data
    })
  }

  async function updateType(id: string, input: UpdateDictionaryType) {
    return feedback.run(async () => {
      const result = await api.updateDictionaryType(id, input)
      if (result.error !== null) throw result.error
      replaceType(result.data.type)
      return result.data
    })
  }

  function adoptDetail(detail: DictionaryTypeDetail) {
    replaceType(detail.type)
  }

  return {
    categories,
    types,
    groups,
    selectedKind,
    selectedCategory,
    selectedCategoryId,
    selectedType,
    selectedTypeId,
    search,
    load,
    selectCategory,
    selectType,
    replaceType,
    createCategory,
    updateCategory,
    deleteCategory,
    createType,
    updateType,
    adoptDetail,
  }
}
