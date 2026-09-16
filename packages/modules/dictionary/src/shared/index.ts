import { z } from 'zod'

export const dictionaryStatuses = ['ENABLED', 'DISABLED'] as const
export type DictionaryStatus = (typeof dictionaryStatuses)[number]

export const dictionaryCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, '编码只能使用小写字母、数字、点、下划线和连字符')
export const dictionaryNameSchema = z.string().trim().min(1).max(200)
export const dictionarySortOrderSchema = z.number().int().min(-100_000).max(100_000)
export const dictionaryRevisionSchema = z.number().int().positive()

export const dictionaryCategorySchema = z
  .object({
    id: z.uuid(),
    code: dictionaryCodeSchema,
    name: dictionaryNameSchema,
    sortOrder: dictionarySortOrderSchema,
    revision: dictionaryRevisionSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .meta({ id: 'DictionaryCategory' })

export const dictionaryTypeSchema = z
  .object({
    id: z.uuid(),
    categoryId: z.uuid(),
    code: dictionaryCodeSchema,
    name: dictionaryNameSchema,
    status: z.enum(dictionaryStatuses),
    revision: dictionaryRevisionSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .meta({ id: 'DictionaryType' })

export const dictionaryItemSchema = z
  .object({
    id: z.uuid(),
    typeId: z.uuid(),
    code: dictionaryCodeSchema,
    label: dictionaryNameSchema,
    status: z.enum(dictionaryStatuses),
    sortOrder: dictionarySortOrderSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .meta({ id: 'DictionaryItem' })

export const dictionaryCatalogSchema = z
  .object({
    categories: z.array(dictionaryCategorySchema).max(100),
    types: z.array(dictionaryTypeSchema).max(500),
  })
  .strict()
  .meta({ id: 'DictionaryCatalog' })

export const dictionaryTypeDetailSchema = z
  .object({
    type: dictionaryTypeSchema,
    items: z.array(dictionaryItemSchema).max(1_000),
  })
  .strict()
  .meta({ id: 'DictionaryTypeDetail' })

export const createDictionaryCategorySchema = z
  .object({
    code: dictionaryCodeSchema,
    name: dictionaryNameSchema,
    sortOrder: dictionarySortOrderSchema.optional(),
  })
  .strict()
  .meta({ id: 'DictionaryCreateCategoryInput' })

export const updateDictionaryCategorySchema = z
  .object({
    name: dictionaryNameSchema.optional(),
    sortOrder: dictionarySortOrderSchema.optional(),
    expectedRevision: dictionaryRevisionSchema,
  })
  .strict()
  .meta({ id: 'DictionaryUpdateCategoryInput' })

export const createDictionaryTypeSchema = z
  .object({
    categoryId: z.uuid(),
    code: dictionaryCodeSchema,
    name: dictionaryNameSchema,
    status: z.enum(dictionaryStatuses).optional(),
  })
  .strict()
  .meta({ id: 'DictionaryCreateTypeInput' })

export const updateDictionaryTypeSchema = z
  .object({
    categoryId: z.uuid().optional(),
    name: dictionaryNameSchema.optional(),
    status: z.enum(dictionaryStatuses).optional(),
    expectedRevision: dictionaryRevisionSchema,
  })
  .strict()
  .meta({ id: 'DictionaryUpdateTypeInput' })

export const createDictionaryItemSchema = z
  .object({
    code: dictionaryCodeSchema,
    label: dictionaryNameSchema,
    status: z.enum(dictionaryStatuses).optional(),
    sortOrder: dictionarySortOrderSchema.optional(),
    expectedRevision: dictionaryRevisionSchema,
  })
  .strict()
  .meta({ id: 'DictionaryCreateItemInput' })

export const updateDictionaryItemSchema = z
  .object({
    label: dictionaryNameSchema.optional(),
    status: z.enum(dictionaryStatuses).optional(),
    sortOrder: dictionarySortOrderSchema.optional(),
    expectedRevision: dictionaryRevisionSchema,
  })
  .strict()
  .meta({ id: 'DictionaryUpdateItemInput' })

export const dictionaryRefSchema = z.object({ id: z.uuid() }).strict().meta({ id: 'DictionaryRef' })

export const deleteDictionaryCategoryQuerySchema = z
  .object({ expectedRevision: z.coerce.number().int().positive() })
  .strict()

export type DictionaryCategory = z.infer<typeof dictionaryCategorySchema>
export type DictionaryType = z.infer<typeof dictionaryTypeSchema>
export type DictionaryItem = z.infer<typeof dictionaryItemSchema>
export type DictionaryCatalog = z.infer<typeof dictionaryCatalogSchema>
export type DictionaryTypeDetail = z.infer<typeof dictionaryTypeDetailSchema>
export type CreateDictionaryCategory = z.infer<typeof createDictionaryCategorySchema>
export type UpdateDictionaryCategory = z.infer<typeof updateDictionaryCategorySchema>
export type CreateDictionaryType = z.infer<typeof createDictionaryTypeSchema>
export type UpdateDictionaryType = z.infer<typeof updateDictionaryTypeSchema>
export type CreateDictionaryItem = z.infer<typeof createDictionaryItemSchema>
export type UpdateDictionaryItem = z.infer<typeof updateDictionaryItemSchema>

export interface DictionaryItemSnapshot {
  readonly code: string
  readonly label: string
  readonly enabled: boolean
}

export interface DictionarySnapshot {
  readonly code: string
  readonly name: string
  readonly enabled: boolean
  readonly revision: number
  readonly items: readonly DictionaryItemSnapshot[]
}

export function compareDictionaryCategories(
  left: DictionaryCategory,
  right: DictionaryCategory,
): number {
  return left.sortOrder - right.sortOrder || left.code.localeCompare(right.code)
}

export function compareDictionaryItems(left: DictionaryItem, right: DictionaryItem): number {
  return left.sortOrder - right.sortOrder || left.code.localeCompare(right.code)
}
