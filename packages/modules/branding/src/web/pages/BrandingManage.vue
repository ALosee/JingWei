<script setup lang="ts">
import { computed, ref } from 'vue'

import { Button, Icon, Input, Select, Textarea, toast } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import {
  defaultBrandConfiguration,
  type BrandAssetPurpose,
  type BrandVisualTheme,
  type BrandWorkspaceDefaults,
  type HorizontalBrandMode,
  type LogoColorMode,
} from '../../shared/index.js'
import BrandingAssetPicker from '../components/branding-asset-picker.vue'
import BrandingCommandBar from '../components/branding-command-bar.vue'
import BrandingLivePreview from '../components/branding-live-preview.vue'
import BrandingThemeEditor from '../components/branding-theme-editor.vue'
import BrandingWorkspaceDefaultsEditor from '../components/branding-workspace-defaults-editor.vue'
import { useBrandingManagement } from '../composables/use-branding-management.js'

const management = useBrandingManagement()
const {
  admin,
  version,
  dirty,
  error,
  fieldErrors,
  busy,
  canManage,
  canPublish,
  canSave,
  readOnly,
} = management

const preview = computed(() => version.value ?? defaultBrandConfiguration)
const logo = computed(() => version.value?.logoAsset?.url ?? null)
const mark = computed(() => version.value?.markAsset?.url ?? null)
const favicon = computed(() => version.value?.faviconAsset?.url ?? null)
type BrandSection = 'identity' | 'copy' | 'theme' | 'workspace'
const activeSection = ref<BrandSection>('identity')
const previewExpanded = ref(false)
const sections: { value: BrandSection; label: string; icon: string }[] = [
  { value: 'identity', label: '品牌标识', icon: 'lucide:badge' },
  { value: 'copy', label: '名称与文案', icon: 'lucide:type' },
  { value: 'theme', label: '视觉主题', icon: 'lucide:swatch-book' },
  { value: 'workspace', label: '工作区布局', icon: 'lucide:panels-top-left' },
]
const sectionFields: Record<BrandSection, readonly string[]> = {
  identity: [
    'horizontalBrandMode',
    'logoColorMode',
    'logoAssetId',
    'markAssetId',
    'faviconAssetId',
  ],
  copy: ['systemName', 'shortName', 'loginTitle', 'loginTagline', 'titleMode'],
  theme: ['visualTheme'],
  workspace: ['workspaceDefaults'],
}

const isDraft = computed(() => version.value?.status === 'DRAFT')
const isPlatformDefault = computed(() => version.value === null)
const formDisabled = computed(() => readOnly.value || !canManage.value)

const titleModeItems: SelectSingleOptionData<string>[] = [
  { value: 'PAGE_AND_SYSTEM', label: '当前页面 · 系统名称' },
  { value: 'SYSTEM_ONLY', label: '仅系统名称' },
]

function sectionErrorMessages(section: BrandSection): string[] {
  const messages: string[] = []
  for (const [key, message] of Object.entries(fieldErrors.value)) {
    if (
      typeof message === 'string' &&
      sectionFields[section].some((field) => key === field || key.startsWith(`${field}.`))
    )
      messages.push(message)
  }
  return messages
}

function sectionHasError(section: BrandSection): boolean {
  return sectionErrorMessages(section).length > 0
}

function showSection(section: BrandSection): void {
  activeSection.value = section
}

function showFirstErrorSection(): void {
  const section = sections.find((item) => sectionHasError(item.value))
  if (section) showSection(section.value)
}

async function upload(purpose: BrandAssetPurpose, file: File): Promise<void> {
  if (await management.upload(purpose, file)) toast.success('素材已上传，保存草稿后生效')
}

async function save(): Promise<void> {
  if (await management.save()) toast.success('品牌草稿已保存')
  else if (Object.keys(fieldErrors.value).length > 0) {
    showFirstErrorSection()
    toast.error('请修正表单校验错误后再保存')
  }
}

async function publish(rollback: boolean): Promise<void> {
  if (await management.publish(rollback)) toast.success(rollback ? '品牌已回滚' : '品牌已发布')
  else showFirstErrorSection()
}

async function restoreDefault(): Promise<void> {
  if (await management.restoreDefault()) toast.success('已恢复平台默认品牌')
}

function fieldError(key: keyof typeof fieldErrors.value): string | undefined {
  return fieldErrors.value[key]
}

function inputClass(key: 'systemName' | 'shortName' | 'loginTitle' | 'loginTagline'): string {
  return fieldError(key) === undefined ? '' : 'border-destructive focus-visible:ring-destructive/30'
}

function onTitleModeChange(value: unknown): void {
  if (formDisabled.value || version.value === null || typeof value !== 'string') return
  if (value !== 'PAGE_AND_SYSTEM' && value !== 'SYSTEM_ONLY') return
  version.value.titleMode = value
  management.markDirty('titleMode')
}

function updateHorizontalBrandMode(mode: HorizontalBrandMode): void {
  if (formDisabled.value || version.value === null) return
  version.value.horizontalBrandMode = mode
  management.markDirty('horizontalBrandMode')
}

function updateLogoColorMode(mode: LogoColorMode): void {
  if (formDisabled.value || version.value === null) return
  version.value.logoColorMode = mode
  management.markDirty('logoColorMode')
}

function updateVisualTheme(value: BrandVisualTheme): void {
  if (formDisabled.value || version.value === null) return
  version.value.visualTheme = value
  management.markDirty('visualTheme')
}

function updateWorkspaceDefaults(value: BrandWorkspaceDefaults): void {
  if (formDisabled.value || version.value === null) return
  version.value.workspaceDefaults = value
  management.markDirty('workspaceDefaults')
}
</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
    <div
      v-if="error"
      role="alert"
      class="shrink-0 border-b border-destructive/20 bg-destructive/8 px-4 py-2 text-sm text-destructive"
    >
      {{ error }}
    </div>

    <BrandingCommandBar
      :admin="admin"
      :version="version"
      :busy="busy"
      :read-only="readOnly"
      :dirty="dirty"
      :can-manage="canManage"
      :can-publish="canPublish"
      :can-save="canSave"
      @select-version="management.selectVersion"
      @create-draft-from-version="management.createDraftFromSelected"
      @create-default-draft="management.createDefaultDraft"
      @delete-draft="management.deleteDraft"
      @restore-default="restoreDefault"
      @save="save"
      @publish="publish"
    />

    <div
      class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(11rem,0.7fr)_minmax(20rem,1.5fr)_minmax(18rem,1fr)]"
    >
      <nav
        aria-label="品牌配置分区"
        class="min-h-0 overflow-y-auto border-b border-border p-2 xl:border-b-0 xl:border-e xl:border-border"
      >
        <button
          v-for="section in sections"
          :key="section.value"
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors-150 focus-visible:outline-2 focus-visible:outline-primary"
          :class="
            activeSection === section.value
              ? 'bg-primary/10 text-primary font-600'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          "
          :aria-pressed="activeSection === section.value"
          @click="showSection(section.value)"
        >
          <Icon :icon="section.icon" class="size-4 shrink-0" />
          <span class="min-w-0 flex-1 truncate">{{ section.label }}</span>
          <Icon
            v-if="sectionHasError(section.value)"
            icon="lucide:circle-alert"
            class="size-3.5 shrink-0 text-destructive"
          />
          <span v-if="sectionHasError(section.value)" class="sr-only">有校验错误</span>
        </button>
      </nav>

      <section
        class="min-h-0 overflow-y-auto border-b border-border px-4 py-4 xl:border-b-0 xl:border-e xl:border-border"
      >
        <div
          v-if="sectionHasError(activeSection)"
          role="alert"
          class="mb-4 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
        >
          <p class="m-0 font-600">请修正当前分区的校验错误：</p>
          <ul class="mb-0 mt-1 list-disc pl-5">
            <li v-for="(issue, index) in sectionErrorMessages(activeSection)" :key="index">
              {{ issue }}
            </li>
          </ul>
        </div>

        <template v-if="version">
          <BrandingAssetPicker
            v-if="activeSection === 'identity'"
            :logo-url="logo"
            :mark-url="mark"
            :favicon-url="favicon"
            :short-name="version.shortName"
            :horizontal-brand-mode="version.horizontalBrandMode"
            :logo-color-mode="version.logoColorMode"
            :busy="busy"
            :read-only="readOnly"
            :can-manage="canManage"
            @upload="upload"
            @remove="management.removeAsset"
            @update-horizontal-brand-mode="updateHorizontalBrandMode"
            @update-logo-color-mode="updateLogoColorMode"
          />

          <section v-if="activeSection === 'copy'" class="grid gap-4">
            <header>
              <h2 class="m-0 text-sm font-semibold text-foreground">名称与文案</h2>
              <p class="mb-0 mt-1 text-xs text-muted-foreground">
                工作区、登录页与浏览器标题使用的文字内容
              </p>
            </header>

            <label class="grid gap-1.5" for="brand-system-name">
              <span class="text-xs text-muted-foreground">
                系统全称 <span class="text-destructive">*</span>
              </span>
              <div class="flex items-center gap-2">
                <Input
                  id="brand-system-name"
                  v-model="version.systemName"
                  :maxlength="80"
                  :disabled="formDisabled"
                  class="min-w-0 flex-1"
                  :class="inputClass('systemName')"
                  placeholder="例如：经纬企业平台"
                  @update:model-value="management.markDirty('systemName')"
                />
                <span class="shrink-0 text-xs text-muted-foreground">
                  {{ version.systemName.length }}/80
                </span>
              </div>
              <span v-if="fieldError('systemName')" class="text-xs text-destructive">
                {{ fieldError('systemName') }}
              </span>
            </label>

            <label class="grid gap-1.5" for="brand-short-name">
              <span class="text-xs text-muted-foreground">
                系统简称 <span class="text-destructive">*</span>
              </span>
              <div class="flex items-center gap-2">
                <Input
                  id="brand-short-name"
                  v-model="version.shortName"
                  :maxlength="24"
                  :disabled="formDisabled"
                  class="min-w-0 flex-1"
                  :class="inputClass('shortName')"
                  placeholder="例如：经纬"
                  @update:model-value="management.markDirty('shortName')"
                />
                <span class="shrink-0 text-xs text-muted-foreground">
                  {{ version.shortName.length }}/24
                </span>
              </div>
              <span v-if="fieldError('shortName')" class="text-xs text-destructive">
                {{ fieldError('shortName') }}
              </span>
            </label>

            <label class="grid gap-1.5" for="brand-login-title">
              <span class="text-xs text-muted-foreground">
                登录页标题 <span class="text-destructive">*</span>
              </span>
              <div class="flex items-center gap-2">
                <Input
                  id="brand-login-title"
                  v-model="version.loginTitle"
                  :maxlength="100"
                  :disabled="formDisabled"
                  class="min-w-0 flex-1"
                  :class="inputClass('loginTitle')"
                  placeholder="登录页主标题"
                  @update:model-value="management.markDirty('loginTitle')"
                />
                <span class="shrink-0 text-xs text-muted-foreground">
                  {{ version.loginTitle.length }}/100
                </span>
              </div>
              <span v-if="fieldError('loginTitle')" class="text-xs text-destructive">
                {{ fieldError('loginTitle') }}
              </span>
            </label>

            <label class="grid gap-1.5" for="brand-login-tagline">
              <span class="text-xs text-muted-foreground">登录页说明</span>
              <Textarea
                id="brand-login-tagline"
                v-model="version.loginTagline"
                :maxlength="240"
                :rows="3"
                :disabled="formDisabled"
                :class="inputClass('loginTagline')"
                placeholder="登录页标题下方的说明文字（可选）"
                @update:model-value="management.markDirty('loginTagline')"
              />
              <div class="flex items-center justify-between gap-2">
                <span v-if="fieldError('loginTagline')" class="text-xs text-destructive">
                  {{ fieldError('loginTagline') }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ version.loginTagline.length }}/240
                </span>
              </div>
            </label>

            <label class="grid gap-1.5" for="brand-title-mode">
              <span class="text-xs text-muted-foreground">浏览器标题</span>
              <Select
                id="brand-title-mode"
                :model-value="version.titleMode"
                :items="titleModeItems"
                :disabled="formDisabled"
                class="w-full max-w-md"
                @update:model-value="onTitleModeChange"
              />
              <span v-if="fieldError('titleMode')" class="text-xs text-destructive">
                {{ fieldError('titleMode') }}
              </span>
            </label>
          </section>

          <BrandingThemeEditor
            v-show="activeSection === 'theme'"
            :model-value="version.visualTheme"
            :disabled="formDisabled"
            @update:model-value="updateVisualTheme"
          />

          <BrandingWorkspaceDefaultsEditor
            v-if="activeSection === 'workspace'"
            :model-value="version.workspaceDefaults"
            :disabled="formDisabled"
            @update:model-value="updateWorkspaceDefaults"
          />
        </template>

        <div v-else class="grid min-h-64 place-items-center px-4 py-10 text-center">
          <div class="max-w-md">
            <div
              class="mx-auto mb-4 size-12 grid place-items-center rounded-full bg-primary/10 text-primary"
            >
              <Icon icon="lucide:palette" class="size-6" />
            </div>
            <h2 class="m-0 text-base text-foreground font-650">平台内置默认品牌</h2>
            <p class="mb-4 mt-2 text-sm text-muted-foreground">
              {{
                admin.versions.length === 0
                  ? '当前租户尚未创建品牌版本，线上使用平台内置默认品牌。'
                  : '当前正在查看平台内置默认品牌；历史版本可从上方版本栏选择。'
              }}
            </p>
            <Button :disabled="busy || !canManage" @click="management.createDefaultDraft">
              从平台默认新建草稿
            </Button>
          </div>
        </div>
      </section>

      <aside class="flex min-h-0 flex-col overflow-hidden p-3">
        <Button
          variant="outline"
          class="mb-2 w-full xl:hidden"
          :aria-expanded="previewExpanded"
          @click="previewExpanded = !previewExpanded"
        >
          <Icon icon="lucide:eye" class="size-4" />
          {{ previewExpanded ? '收起实时预览' : '展开实时预览' }}
        </Button>
        <div
          class="min-h-0 flex-1 overflow-y-auto"
          :class="previewExpanded ? '' : 'hidden xl:block'"
        >
          <BrandingLivePreview
            :preview="preview"
            :logo-url="logo"
            :mark-url="mark"
            :favicon-url="favicon"
            :state="isPlatformDefault ? 'PLATFORM_DEFAULT' : isDraft ? 'DRAFT' : 'SNAPSHOT'"
          />
        </div>
      </aside>
    </div>
  </div>
</template>
