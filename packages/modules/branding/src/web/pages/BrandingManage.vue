<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import { Button, ButtonLoading, Icon, Input, Select, Textarea, toast } from '@jingwei/ui'
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
import BrandingLivePreview from '../components/branding-live-preview.vue'
import BrandingThemeEditor from '../components/branding-theme-editor.vue'
import BrandingVersionBar from '../components/branding-version-bar.vue'
import BrandingWorkspaceDefaultsEditor from '../components/branding-workspace-defaults-editor.vue'
import { useBrandingManagement } from '../composables/use-branding-management.js'

const management = useBrandingManagement()
const {
  admin,
  version,
  dirty,
  error,
  message,
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
const sectionNavigation = ref<HTMLElement | null>(null)
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

const liveLabel = computed(() => {
  if (admin.value.publishedVersionId === null) return '线上：平台默认'
  const live = admin.value.versions.find((item) => item.id === admin.value.publishedVersionId)
  return live === undefined ? '线上：已发布版本' : `线上：V${live.revision}`
})

const isDraft = computed(() => version.value?.status === 'DRAFT')
const isPlatformDefault = computed(() => version.value === null)
const formDisabled = computed(() => readOnly.value || !canManage.value)
const isLiveVersion = computed(
  () => version.value !== null && version.value.id === admin.value.publishedVersionId,
)
const isHistoricalPublished = computed(
  () =>
    version.value !== null &&
    version.value.status === 'PUBLISHED' &&
    version.value.id !== admin.value.publishedVersionId,
)

const snapshotNotice = computed(() => {
  if (version.value === null) return null
  if (isHistoricalPublished.value)
    return `正在查看 V${version.value.revision} 历史快照，${liveLabel.value}。可回滚或基于此版本新建草稿。`
  if (isLiveVersion.value) return `正在查看当前线上版本 V${version.value.revision}。`
  return null
})

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

async function showSection(section: BrandSection): Promise<void> {
  activeSection.value = section
  await nextTick()
  sectionNavigation.value?.scrollIntoView({ block: 'start' })
}

function showFirstErrorSection(): void {
  const section = sections.find((item) => sectionHasError(item.value))
  if (section) void showSection(section.value)
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
  <div class="grid w-full gap-4">
    <header class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="m-0 text-xl text-foreground font-700">品牌定制</h1>
          <span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-500">
            {{ liveLabel }}
          </span>
        </div>
        <p class="mb-0 mt-1 text-sm text-muted-foreground">
          配置品牌身份、视觉主题和工作区默认布局；草稿不影响线上，发布后新加载页面生效。
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <Button
          v-if="admin.publishedVersionId"
          variant="outline"
          :disabled="busy || dirty || !canPublish"
          @click="restoreDefault"
        >
          恢复平台默认
        </Button>
        <Button
          v-if="!isPlatformDefault"
          variant="outline"
          :disabled="busy || !canManage"
          @click="management.createDefaultDraft"
        >
          从平台默认新建
        </Button>
        <Button
          v-if="isDraft"
          variant="outline"
          color="destructive"
          :disabled="busy || !canManage"
          @click="management.deleteDraft"
        >
          删除草稿
        </Button>
        <ButtonLoading
          v-if="isHistoricalPublished"
          variant="outline"
          :loading="busy"
          :disabled="busy || !canPublish"
          @click="publish(true)"
        >
          回滚到此版本
        </ButtonLoading>
        <ButtonLoading
          v-else-if="isPlatformDefault"
          :loading="busy"
          :disabled="busy || !canManage"
          @click="management.createDefaultDraft"
        >
          从平台默认新建草稿
        </ButtonLoading>
      </div>
    </header>

    <p
      v-if="error"
      role="alert"
      class="m-0 whitespace-pre-wrap rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
    >
      {{ error }}
    </p>
    <p
      v-if="message"
      role="status"
      class="m-0 rounded-md border border-primary/20 bg-primary/8 px-3 py-2 text-sm text-foreground"
    >
      {{ message }}
    </p>
    <p
      v-if="snapshotNotice"
      class="m-0 rounded-md border border-warning/25 bg-warning/8 px-3 py-2 text-sm text-warning"
    >
      {{ snapshotNotice }}
    </p>

    <BrandingVersionBar
      :admin="admin"
      :version="version"
      :busy="busy"
      :read-only="readOnly"
      :dirty="dirty"
      :can-manage="canManage"
      @select-version="management.selectVersion"
      @create-draft-from-version="management.createDraftFromSelected"
    />

    <div
      v-if="version"
      class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.85fr)]"
    >
      <div class="grid min-w-0 content-start gap-4">
        <div
          ref="sectionNavigation"
          class="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/95 p-2 shadow-sm backdrop-blur"
        >
          <nav
            aria-label="品牌配置分区"
            class="min-w-0 flex flex-1 basis-full gap-1 overflow-x-auto lg:basis-auto"
          >
            <button
              v-for="section in sections"
              :key="section.value"
              type="button"
              class="min-w-max flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors-150 focus-visible:outline-2 focus-visible:outline-primary"
              :class="
                activeSection === section.value
                  ? 'bg-primary/10 text-primary font-600 ring-1 ring-primary/15'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              "
              :aria-pressed="activeSection === section.value"
              @click="showSection(section.value)"
            >
              <Icon :icon="section.icon" class="size-4 shrink-0" />
              <span>{{ section.label }}</span>
              <Icon
                v-if="sectionHasError(section.value)"
                icon="lucide:circle-alert"
                class="size-3.5 shrink-0 text-destructive"
              />
              <span v-if="sectionHasError(section.value)" class="sr-only">有校验错误</span>
            </button>
          </nav>
          <div v-if="isDraft" class="ml-auto flex shrink-0 items-center gap-2">
            <ButtonLoading size="sm" :loading="busy" :disabled="!canSave" @click="save">
              保存草稿
            </ButtonLoading>
            <ButtonLoading
              size="sm"
              :loading="busy"
              :disabled="busy || dirty || !canPublish"
              @click="publish(false)"
            >
              发布
            </ButtonLoading>
          </div>
        </div>

        <div class="min-w-0">
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

          <section
            v-if="activeSection === 'copy'"
            class="grid gap-4 rounded-lg border border-border bg-card p-5"
          >
            <header>
              <h2 class="m-0 flex items-center gap-2 text-base text-foreground font-650">
                <Icon icon="lucide:type" class="size-4 text-muted-foreground" />
                名称与文案
              </h2>
              <p class="mb-0 mt-1 text-sm text-muted-foreground">
                工作区、登录页与浏览器标题使用的文字内容。
              </p>
            </header>

            <div class="grid gap-x-8 gap-y-4 lg:grid-cols-[8rem_minmax(0,1fr)] lg:items-start">
              <label for="brand-system-name" class="pt-2 text-sm font-500 text-foreground">
                系统全称
                <span class="text-destructive" aria-hidden="true">*</span>
              </label>
              <div class="grid min-w-0 gap-1">
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
              </div>

              <label for="brand-short-name" class="pt-2 text-sm font-500 text-foreground">
                系统简称
                <span class="text-destructive" aria-hidden="true">*</span>
              </label>
              <div class="grid min-w-0 gap-1">
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
              </div>

              <label for="brand-login-title" class="pt-2 text-sm font-500 text-foreground">
                登录页标题
                <span class="text-destructive" aria-hidden="true">*</span>
              </label>
              <div class="grid min-w-0 gap-1">
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
              </div>

              <label for="brand-login-tagline" class="pt-2 text-sm font-500 text-foreground">
                登录页说明
              </label>
              <div class="grid min-w-0 gap-1">
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
                  <span v-else class="text-xs text-muted-foreground" />
                  <span class="text-xs text-muted-foreground">
                    {{ version.loginTagline.length }}/240
                  </span>
                </div>
              </div>

              <label for="brand-title-mode" class="pt-2 text-sm font-500 text-foreground">
                浏览器标题
              </label>
              <div class="grid min-w-0 gap-1">
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
              </div>
            </div>
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
        </div>
      </div>

      <aside class="order-first grid content-start gap-3 xl:order-last xl:sticky xl:top-4">
        <Button
          variant="outline"
          size="sm"
          class="w-full xl:hidden"
          :aria-expanded="previewExpanded"
          @click="previewExpanded = !previewExpanded"
        >
          <Icon icon="lucide:eye" class="size-4" />
          {{ previewExpanded ? '收起实时预览' : '展开实时预览' }}
        </Button>
        <div :class="previewExpanded ? '' : 'hidden xl:block'">
          <BrandingLivePreview
            :preview="preview"
            :logo-url="logo"
            :mark-url="mark"
            :favicon-url="favicon"
            :state="version.status === 'DRAFT' ? 'DRAFT' : 'SNAPSHOT'"
          />
        </div>
      </aside>
    </div>

    <div v-else class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.85fr)]">
      <section
        class="grid min-h-64 place-items-center rounded-xl border border-dashed border-border bg-card/30 p-8"
      >
        <div class="max-w-md text-center">
          <div
            class="mx-auto mb-4 size-12 grid place-items-center rounded-full bg-primary/10 text-primary"
          >
            <Icon icon="lucide:palette" class="size-6" />
          </div>
          <h2 class="m-0 text-lg text-foreground font-650">平台内置默认品牌</h2>
          <p class="mb-4 mt-2 text-sm text-muted-foreground">
            {{
              admin.versions.length === 0
                ? '当前租户尚未创建品牌版本，线上使用平台内置默认品牌。'
                : '当前正在查看平台内置默认品牌；历史版本仍保留，可从上方版本栏选择。'
            }}
          </p>
          <Button :disabled="busy || !canManage" @click="management.createDefaultDraft">
            从平台默认新建草稿
          </Button>
        </div>
      </section>
      <div class="xl:sticky xl:top-4">
        <BrandingLivePreview
          :preview="preview"
          :logo-url="null"
          :mark-url="null"
          :favicon-url="null"
          state="PLATFORM_DEFAULT"
        />
      </div>
    </div>
  </div>
</template>
