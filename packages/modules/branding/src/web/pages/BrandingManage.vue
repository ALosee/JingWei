<script setup lang="ts">
import { computed } from 'vue'

import { Button, ButtonLoading, Icon, Input, Select, Textarea, toast } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import {
  defaultBrandConfiguration,
  type BrandAssetPurpose,
  type HorizontalBrandMode,
  type LogoColorMode,
} from '../../shared/index.js'
import BrandingAssetPicker from '../components/branding-asset-picker.vue'
import BrandingLivePreview from '../components/branding-live-preview.vue'
import BrandingVersionBar from '../components/branding-version-bar.vue'
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

const titleModeItems: SelectSingleOptionData<string>[] = [
  { value: 'PAGE_AND_SYSTEM', label: '当前页面 · 系统名称' },
  { value: 'SYSTEM_ONLY', label: '仅系统名称' },
]

async function upload(purpose: BrandAssetPurpose, file: File): Promise<void> {
  if (await management.upload(purpose, file)) toast.success('素材已上传，保存草稿后生效')
}

async function save(): Promise<void> {
  if (await management.save()) toast.success('品牌草稿已保存')
  else if (Object.keys(fieldErrors.value).length > 0) toast.error('请修正表单校验错误后再保存')
}

async function publish(rollback: boolean): Promise<void> {
  if (await management.publish(rollback)) toast.success(rollback ? '品牌已回滚' : '品牌已发布')
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
  if (version.value === null || typeof value !== 'string') return
  if (value !== 'PAGE_AND_SYSTEM' && value !== 'SYSTEM_ONLY') return
  version.value.titleMode = value
  management.markDirty('titleMode')
}

function updateHorizontalBrandMode(mode: HorizontalBrandMode): void {
  if (version.value === null) return
  version.value.horizontalBrandMode = mode
  management.markDirty('horizontalBrandMode')
}

function updateLogoColorMode(mode: LogoColorMode): void {
  if (version.value === null) return
  version.value.logoColorMode = mode
  management.markDirty('logoColorMode')
}
</script>

<template>
  <div class="grid w-full gap-4">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="m-0 text-xl text-foreground font-700">品牌定制</h1>
        <p class="mb-0 mt-1 text-sm text-muted-foreground">
          为当前租户统一配置系统名称、工作区标志、登录页文案和浏览器标签。草稿不影响线上，发布后新加载页面生效。
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-if="admin.publishedVersionId"
          variant="outline"
          :disabled="busy || dirty || !canPublish"
          @click="restoreDefault"
        >
          恢复平台默认
        </Button>
        <Button
          v-if="version?.status === 'DRAFT'"
          variant="outline"
          color="destructive"
          :disabled="busy || !canManage"
          @click="management.deleteDraft"
        >
          删除草稿
        </Button>
        <Button
          variant="outline"
          :disabled="busy || !canManage"
          @click="management.createDefaultDraft"
        >
          从平台默认新建
        </Button>
        <ButtonLoading
          v-if="version?.status === 'DRAFT'"
          :loading="busy"
          :disabled="!canSave"
          @click="save"
        >
          保存草稿
        </ButtonLoading>
        <ButtonLoading
          v-if="version?.status === 'DRAFT'"
          :loading="busy"
          :disabled="busy || dirty || !canPublish"
          @click="publish(false)"
        >
          发布
        </ButtonLoading>
        <ButtonLoading
          v-else-if="version && version.id !== admin.publishedVersionId"
          variant="outline"
          :loading="busy"
          :disabled="busy || !canPublish"
          @click="publish(true)"
        >
          回滚到此版本
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
      class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.95fr)]"
    >
      <div class="grid min-w-0 gap-4">
        <section class="grid gap-5 rounded-lg border border-border bg-card p-5">
          <header>
            <h2 class="m-0 flex items-center gap-2 text-base text-foreground font-650">
              <Icon icon="lucide:type" class="size-4 text-muted-foreground" />
              名称与文案
            </h2>
            <p class="mb-0 mt-1 text-sm text-muted-foreground">
              名称会用于工作区、登录页和浏览器标题；简称用于侧栏与紧凑展示。
            </p>
          </header>

          <div class="grid items-start gap-4 md:grid-cols-2">
            <label class="grid gap-1.5 text-sm">
              <span class="flex items-baseline justify-between gap-2">
                <span>
                  系统全称
                  <span class="text-destructive" aria-hidden="true">*</span>
                </span>
                <span class="text-xs text-muted-foreground"
                  >{{ version.systemName.length }}/80</span
                >
              </span>
              <Input
                v-model="version.systemName"
                :maxlength="80"
                :disabled="readOnly"
                :class="inputClass('systemName')"
                placeholder="例如：经纬企业平台"
                @update:model-value="management.markDirty('systemName')"
              />
              <span
                class="min-h-4 text-xs"
                :class="fieldError('systemName') ? 'text-destructive' : 'text-muted-foreground'"
              >
                {{ fieldError('systemName') ?? '用于工作区、登录页与浏览器标题' }}
              </span>
            </label>

            <label class="grid gap-1.5 text-sm">
              <span class="flex items-baseline justify-between gap-2">
                <span>
                  系统简称
                  <span class="text-destructive" aria-hidden="true">*</span>
                </span>
                <span class="text-xs text-muted-foreground">{{ version.shortName.length }}/24</span>
              </span>
              <Input
                v-model="version.shortName"
                :maxlength="24"
                :disabled="readOnly"
                :class="inputClass('shortName')"
                placeholder="例如：经纬"
                @update:model-value="management.markDirty('shortName')"
              />
              <span
                class="min-h-4 text-xs"
                :class="fieldError('shortName') ? 'text-destructive' : 'text-muted-foreground'"
              >
                {{
                  fieldError('shortName') ?? '选择“系统简称”显示方式时用于侧栏与登录页，不能为空'
                }}
              </span>
            </label>

            <label class="grid gap-1.5 text-sm md:col-span-2">
              <span class="flex items-baseline justify-between gap-2">
                <span>
                  登录页标题
                  <span class="text-destructive" aria-hidden="true">*</span>
                </span>
                <span class="text-xs text-muted-foreground"
                  >{{ version.loginTitle.length }}/100</span
                >
              </span>
              <Input
                v-model="version.loginTitle"
                :maxlength="100"
                :disabled="readOnly"
                :class="inputClass('loginTitle')"
                placeholder="登录页主标题"
                @update:model-value="management.markDirty('loginTitle')"
              />
              <span
                class="min-h-4 text-xs"
                :class="fieldError('loginTitle') ? 'text-destructive' : 'text-muted-foreground'"
              >
                {{ fieldError('loginTitle') ?? '登录页主标题，不能为空' }}
              </span>
            </label>

            <label class="grid gap-1.5 text-sm md:col-span-2">
              <span class="flex items-baseline justify-between gap-2">
                <span>登录页说明</span>
                <span class="text-xs text-muted-foreground"
                  >{{ version.loginTagline.length }}/240</span
                >
              </span>
              <Textarea
                v-model="version.loginTagline"
                :maxlength="240"
                :rows="3"
                :disabled="readOnly"
                :class="inputClass('loginTagline')"
                placeholder="一句话说明产品价值，会显示在登录页标题下方。"
                @update:model-value="management.markDirty('loginTagline')"
              />
              <span
                class="min-h-4 text-xs"
                :class="fieldError('loginTagline') ? 'text-destructive' : 'text-muted-foreground'"
              >
                {{ fieldError('loginTagline') ?? '可选，显示在登录页标题下方' }}
              </span>
            </label>

            <label class="grid gap-1.5 text-sm md:col-span-2">
              <span>浏览器标题格式</span>
              <Select
                :model-value="version.titleMode"
                :items="titleModeItems"
                :disabled="readOnly"
                class="w-full"
                @update:model-value="onTitleModeChange"
              />
              <span v-if="fieldError('titleMode')" class="text-xs text-destructive">
                {{ fieldError('titleMode') }}
              </span>
            </label>
          </div>
        </section>

        <BrandingAssetPicker
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
      </div>

      <div class="xl:sticky xl:top-4">
        <BrandingLivePreview
          :preview="preview"
          :logo-url="logo"
          :mark-url="mark"
          :favicon-url="favicon"
          :state="version.status === 'DRAFT' ? 'DRAFT' : 'SNAPSHOT'"
        />
      </div>
    </div>

    <div v-else class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.95fr)]">
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
                ? '当前租户尚未创建品牌版本，线上继续使用平台内置默认品牌。'
                : '当前正在查看平台内置默认品牌；历史版本仍然保留，可从上方版本栏选择。'
            }}
          </p>
          <Button :disabled="busy || !canManage" @click="management.createDefaultDraft">
            以平台默认创建草稿
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
