import { computed, onMounted, ref } from 'vue'

import { useApiRequestState } from '@jingwei/api-client/vue'
import { useIamPermission } from '@jingwei/module-iam/session'

import * as api from '../../client/index.js'
import {
  maximumBrandAssetBytes,
  type BrandAdmin,
  type BrandAssetPurpose,
  type BrandDraftSource,
  type BrandVersion,
  type SaveBrandDraft,
} from '../../shared/index.js'
import { validateBrandSvgText } from '../brand-logo-svg-validation.js'
import {
  mapServerBrandFieldIssues,
  validateSaveBrandDraft,
  type BrandFieldErrors,
} from './brand-draft-validation.js'
import { resolveBrandVersionSelection } from './brand-version-selection.js'

export type { BrandFieldErrors }

export function useBrandingManagement() {
  const admin = ref<BrandAdmin>({ publishedVersionId: null, versions: [] })
  const version = ref<BrandVersion | null>(null)
  const dirty = ref(false)
  const error = ref('')
  const message = ref('')
  const fieldErrors = ref<BrandFieldErrors>({})
  const request = useApiRequestState()
  const canManage = useIamPermission('branding.manage')
  const canPublish = useIamPermission('branding.publish')
  const readOnly = computed(() => version.value?.status !== 'DRAFT')
  const canSave = computed(() => !readOnly.value && dirty.value && canManage.value)

  function feedback(result: { error: Error | null }): boolean {
    if (result.error === null) return true
    error.value = result.error.message
    const details =
      'details' in result.error ? (result.error as { details?: unknown }).details : undefined
    const mapped = mapServerBrandFieldIssues(details)
    if (Object.keys(mapped).length > 0) fieldErrors.value = mapped
    return false
  }

  function clearFeedback(): void {
    error.value = ''
    message.value = ''
    fieldErrors.value = {}
  }

  async function loadIndex(preferredId?: string | null): Promise<void> {
    clearFeedback()
    const result = await api.getBrandAdmin(request.options)
    if (!feedback(result) || result.data === null) return
    admin.value = result.data
    const id = resolveBrandVersionSelection(result.data, preferredId)
    if (id === null) {
      version.value = null
      dirty.value = false
      return
    }
    const selected = await api.getBrandVersion(id, request.options)
    if (!feedback(selected) || selected.data === null) return
    version.value = selected.data
    dirty.value = false
  }

  async function selectVersion(id: string | null): Promise<void> {
    if (dirty.value && !window.confirm('当前修改尚未保存，是否放弃？')) return
    await loadIndex(id)
  }

  async function createDraft(source: BrandDraftSource): Promise<void> {
    if (dirty.value && !window.confirm('当前修改尚未保存，是否放弃并创建新草稿？')) return
    clearFeedback()
    const result = await api.createBrandDraft(source, request.options)
    if (!feedback(result) || result.data === null) return
    version.value = result.data
    dirty.value = false
    await loadIndex(result.data.id)
    message.value = '已创建品牌草稿，线上品牌不受影响。'
  }

  function createDefaultDraft(): Promise<void> {
    return createDraft({ kind: 'PLATFORM_DEFAULT' })
  }

  function createDraftFromSelected(): Promise<void> {
    const current = version.value
    if (current === null) return createDefaultDraft()
    return createDraft({ kind: 'VERSION', versionId: current.id })
  }

  function buildDraftInput(): SaveBrandDraft | null {
    const current = version.value
    if (current?.status !== 'DRAFT') return null
    const input: SaveBrandDraft = {
      expectedEditRevision: current.editRevision,
      systemName: current.systemName,
      shortName: current.shortName,
      loginTitle: current.loginTitle,
      loginTagline: current.loginTagline,
      titleMode: current.titleMode,
      horizontalBrandMode: current.horizontalBrandMode,
      logoColorMode: current.logoColorMode,
      logoAssetId: current.logoAssetId,
      markAssetId: current.markAssetId,
      faviconAssetId: current.faviconAssetId,
    }
    const validated = validateSaveBrandDraft(input)
    if (!validated.ok) {
      fieldErrors.value = validated.errors
      error.value = '请先修正表单中的校验错误'
      return null
    }
    fieldErrors.value = {}
    return validated.data
  }

  async function save(): Promise<boolean> {
    if (version.value?.status !== 'DRAFT') return false
    clearFeedback()
    const input = buildDraftInput()
    if (input === null) return false
    const result = await api.saveBrandDraft(version.value.id, input, request.options)
    if (!feedback(result) || result.data === null) return false
    version.value = result.data
    dirty.value = false
    await loadIndex(result.data.id)
    message.value = '品牌草稿已保存，尚未发布。'
    return true
  }

  async function publish(rollback: boolean): Promise<boolean> {
    if (version.value === null || dirty.value) return false
    const confirmed = window.confirm(
      rollback ? '将线上品牌切换到所选历史版本？' : '发布此草稿并替换当前线上品牌？',
    )
    if (!confirmed) return false
    clearFeedback()
    const result = await api.publishBrandVersion(
      version.value.id,
      {
        expectedEditRevision: version.value.editRevision,
        expectedPublishedVersionId: admin.value.publishedVersionId,
      },
      rollback,
      request.options,
    )
    if (!feedback(result) || result.data === null) return false
    await loadIndex(result.data.id)
    message.value = rollback ? '已回滚品牌版本。' : '品牌已发布，刷新页面后全局生效。'
    return true
  }

  async function deleteDraft(): Promise<void> {
    if (version.value?.status !== 'DRAFT' || !window.confirm('删除当前品牌草稿？')) return
    const deletedId = version.value.id
    clearFeedback()
    const result = await api.deleteBrandDraft(deletedId, request.options)
    if (!feedback(result)) return
    version.value = null
    dirty.value = false
    await loadIndex()
    message.value = '品牌草稿已删除。'
  }

  async function upload(purpose: BrandAssetPurpose, file: File): Promise<boolean> {
    if (version.value === null || readOnly.value) return false
    if (purpose === 'LOGO' && version.value.horizontalBrandMode !== 'CUSTOM_LOGO') {
      clearFeedback()
      error.value = '请先将横向品牌显示切换为「自定义 Logo」，再上传横向 Logo'
      return false
    }
    clearFeedback()
    if (file.size === 0 || file.size > maximumBrandAssetBytes) {
      error.value = '品牌素材不能为空且不能超过 2 MiB'
      return false
    }
    const looksLikeSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
    const looksLikeIco =
      file.type === 'image/x-icon' ||
      file.type === 'image/vnd.microsoft.icon' ||
      file.name.toLowerCase().endsWith('.ico')
    if (looksLikeIco) {
      if (purpose !== 'FAVICON') {
        error.value = '只有 Favicon 支持 ICO，横向 Logo 与方形标志请使用 PNG 或 SVG'
        return false
      }
    }
    if (looksLikeSvg) {
      if (purpose !== 'LOGO' && purpose !== 'MARK') {
        error.value = '横向 Logo 与方形标志支持 SVG，Favicon 请使用 PNG 或 ICO'
        return false
      }
      try {
        validateBrandSvgText(await file.text(), purpose)
      } catch (validationError) {
        error.value = validationError instanceof Error ? validationError.message : 'SVG 校验失败'
        return false
      }
    }
    const result = await api.uploadBrandAsset(purpose, file, request.options)
    if (!feedback(result) || result.data === null) return false
    if (purpose === 'LOGO') {
      if (result.data.purpose !== 'LOGO') {
        error.value = '服务端返回的素材用途与上传位置不一致'
        return false
      }
      version.value.logoAssetId = result.data.id
      version.value.logoAsset = result.data
    } else if (purpose === 'MARK') {
      if (result.data.purpose !== 'MARK') {
        error.value = '服务端返回的素材用途与上传位置不一致'
        return false
      }
      version.value.markAssetId = result.data.id
      version.value.markAsset = result.data
    } else {
      if (result.data.purpose !== 'FAVICON') {
        error.value = '服务端返回的素材用途与上传位置不一致'
        return false
      }
      version.value.faviconAssetId = result.data.id
      version.value.faviconAsset = result.data
    }
    dirty.value = true
    return true
  }

  function removeAsset(purpose: BrandAssetPurpose): void {
    if (version.value === null || readOnly.value) return
    if (purpose === 'LOGO') {
      version.value.logoAssetId = null
      version.value.logoAsset = null
      // Keep configuration valid: CUSTOM_LOGO requires an uploaded logo.
      if (version.value.horizontalBrandMode === 'CUSTOM_LOGO')
        version.value.horizontalBrandMode = 'PLATFORM_WORDMARK'
    } else if (purpose === 'MARK') {
      version.value.markAssetId = null
      version.value.markAsset = null
    } else {
      version.value.faviconAssetId = null
      version.value.faviconAsset = null
    }
    dirty.value = true
  }

  function clearFieldError(key: keyof SaveBrandDraft): void {
    if (!(key in fieldErrors.value)) return
    const next: BrandFieldErrors = {}
    for (const [field, message] of Object.entries(fieldErrors.value)) {
      if (field !== key) next[field as keyof SaveBrandDraft] = message
    }
    fieldErrors.value = next
  }

  function markDirty(key?: keyof SaveBrandDraft): void {
    dirty.value = true
    if (key !== undefined) clearFieldError(key)
  }

  async function restoreDefault(): Promise<boolean> {
    const publishedVersionId = admin.value.publishedVersionId
    if (publishedVersionId === null) return false
    if (
      !window.confirm('恢复平台内置默认品牌？已发布的品牌版本会保留，之后仍可回滚到任一历史版本。')
    )
      return false
    clearFeedback()
    const result = await api.restoreDefaultBrand(publishedVersionId, request.options)
    if (!feedback(result) || result.data === null) return false
    await loadIndex(null)
    message.value = '已恢复平台内置默认品牌，历史版本仍然保留。'
    return true
  }

  onMounted(() => void loadIndex())

  return {
    admin,
    version,
    dirty,
    error,
    message,
    fieldErrors,
    busy: request.loading,
    canManage,
    canPublish,
    canSave,
    readOnly,
    selectVersion,
    createDefaultDraft,
    createDraftFromSelected,
    save,
    publish,
    deleteDraft,
    upload,
    removeAsset,
    markDirty,
    restoreDefault,
  }
}
