<script setup lang="ts">
import { computed } from 'vue'

import { Button, Icon, Segment } from '@jingwei/ui'
import type { SegmentOptionData } from '@jingwei/ui'

import {
  type BrandAssetPurpose,
  type HorizontalBrandMode,
  type LogoColorMode,
} from '../../shared/index.js'
import BrandLogoAsset from './brand-logo-asset.vue'
import DefaultBrandMark from './default-brand-mark.vue'
import DefaultBrandWordmark from './default-brand-wordmark.vue'

interface AssetSlot {
  purpose: BrandAssetPurpose
  label: string
  url: string | null
  frameClass: string
  accept: string
  primary: boolean
}

const props = defineProps<{
  logoUrl: string | null
  markUrl: string | null
  faviconUrl: string | null
  shortName: string
  horizontalBrandMode: HorizontalBrandMode
  logoColorMode: LogoColorMode
  busy: boolean
  readOnly: boolean
  canManage: boolean
}>()

const emit = defineEmits<{
  upload: [purpose: BrandAssetPurpose, file: File]
  remove: [purpose: BrandAssetPurpose]
  updateHorizontalBrandMode: [mode: HorizontalBrandMode]
  updateLogoColorMode: [mode: LogoColorMode]
}>()

const horizontalModeLocked = computed(() => props.readOnly || !props.canManage)
const horizontalModeItems = computed<SegmentOptionData<HorizontalBrandMode>[]>(() => [
  { value: 'PLATFORM_WORDMARK', label: '平台字标', disabled: horizontalModeLocked.value },
  { value: 'SHORT_NAME', label: '系统简称', disabled: horizontalModeLocked.value },
  { value: 'CUSTOM_LOGO', label: '自定义 Logo', disabled: horizontalModeLocked.value },
])

const logoEditable = computed(
  () => props.horizontalBrandMode === 'CUSTOM_LOGO' && !props.readOnly && props.canManage,
)

const logoColorDisabled = computed(
  () => props.readOnly || !props.canManage || props.horizontalBrandMode !== 'CUSTOM_LOGO',
)
const logoColorModeItems = computed<SegmentOptionData<LogoColorMode>[]>(() => [
  { value: 'ORIGINAL', label: '保持原色', disabled: logoColorDisabled.value },
  { value: 'FOLLOW_THEME', label: '单色跟随主题', disabled: logoColorDisabled.value },
])

function logoBadge(url: string | null): { text: string; className: string } {
  if (props.horizontalBrandMode === 'CUSTOM_LOGO') {
    return url === null
      ? { text: '待上传', className: 'bg-warning/12 text-warning' }
      : { text: '已上传', className: 'bg-success/12 text-success' }
  }
  return url === null
    ? { text: '按显示模式', className: 'bg-muted text-muted-foreground' }
    : { text: '已保留', className: 'bg-muted text-muted-foreground' }
}

const assets = computed<AssetSlot[]>(() => [
  {
    purpose: 'LOGO',
    label: '横向 Logo',
    url: props.logoUrl,
    frameClass: 'h-12 w-32',
    accept: 'image/png,image/svg+xml,.svg',
    primary: true,
  },
  {
    purpose: 'MARK',
    label: '方形标志',
    url: props.markUrl,
    frameClass: 'size-12',
    accept: 'image/png,image/svg+xml,.svg',
    primary: false,
  },
  {
    purpose: 'FAVICON',
    label: 'Favicon',
    url: props.faviconUrl,
    frameClass: 'size-9',
    accept: 'image/png,image/x-icon,.ico',
    primary: false,
  },
])

function assetControlsEnabled(purpose: BrandAssetPurpose): boolean {
  if (purpose === 'LOGO') return logoEditable.value
  return !props.readOnly && props.canManage
}

function removeEnabled(purpose: BrandAssetPurpose, url: string | null): boolean {
  return url !== null && assetControlsEnabled(purpose)
}

function fileFrom(event: Event): File | null {
  if (!(event.currentTarget instanceof HTMLInputElement)) return null
  const file = event.currentTarget.files?.[0] ?? null
  event.currentTarget.value = ''
  return file
}

function onUpload(purpose: BrandAssetPurpose, event: Event): void {
  const file = fileFrom(event)
  if (file === null) return
  emit('upload', purpose, file)
}

function onHorizontalBrandModeChange(value: unknown): void {
  if (horizontalModeLocked.value) return
  if (value === 'PLATFORM_WORDMARK' || value === 'SHORT_NAME' || value === 'CUSTOM_LOGO')
    emit('updateHorizontalBrandMode', value)
}

function onLogoColorModeChange(value: unknown): void {
  if (logoColorDisabled.value) return
  if (value === 'ORIGINAL' || value === 'FOLLOW_THEME') emit('updateLogoColorMode', value)
}
</script>

<template>
  <section class="grid gap-4 rounded-lg border border-border bg-card p-5">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="m-0 flex items-center gap-2 text-base text-foreground font-650">
          <Icon icon="lucide:badge" class="size-4 text-muted-foreground" />
          品牌标识
        </h2>
        <p class="mb-0 mt-1 text-sm text-muted-foreground">
          控制侧栏与登录页的横向品牌位；素材上传后需保存草稿并发布。
        </p>
      </div>
    </header>

    <div class="grid gap-3">
      <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <span class="shrink-0 text-sm font-500 text-foreground">横向品牌显示</span>
        <Segment
          :model-value="horizontalBrandMode"
          :items="horizontalModeItems"
          size="sm"
          fill="full"
          class="min-w-0 flex-1 sm:flex-none sm:w-auto"
          :class="horizontalModeLocked ? 'pointer-events-none opacity-50' : ''"
          @update:model-value="onHorizontalBrandModeChange"
        />
      </div>

      <div
        v-if="horizontalBrandMode === 'CUSTOM_LOGO'"
        class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2"
      >
        <span class="shrink-0 text-sm font-500 text-foreground">Logo 颜色</span>
        <Segment
          :model-value="logoColorMode"
          :items="logoColorModeItems"
          size="sm"
          fill="full"
          class="min-w-0 flex-1 sm:flex-none sm:w-auto"
          :class="logoColorDisabled ? 'pointer-events-none opacity-50' : ''"
          @update:model-value="onLogoColorModeChange"
        />
      </div>
    </div>

    <div class="grid gap-2">
      <article
        v-for="asset in assets"
        :key="asset.purpose"
        class="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 transition-colors-150"
        :class="
          asset.purpose === 'LOGO' && horizontalBrandMode === 'CUSTOM_LOGO'
            ? 'bg-primary/5 ring-1 ring-primary/20'
            : ''
        "
      >
        <div
          class="grid shrink-0 place-items-center"
          :class="[
            asset.frameClass,
            asset.purpose === 'MARK' && asset.url
              ? 'overflow-visible'
              : 'overflow-hidden rounded-md border border-border bg-background',
          ]"
        >
          <template v-if="asset.purpose === 'LOGO'">
            <BrandLogoAsset
              v-if="horizontalBrandMode === 'CUSTOM_LOGO' && asset.url"
              :src="asset.url"
              :color-mode="logoColorMode"
              class="size-full"
            />
            <DefaultBrandWordmark
              v-else-if="horizontalBrandMode === 'PLATFORM_WORDMARK'"
              class="h-4 max-w-24 text-primary"
            />
            <span
              v-else-if="horizontalBrandMode === 'SHORT_NAME'"
              class="px-2 text-sm text-muted-foreground font-650"
            >
              {{ shortName || '—' }}
            </span>
            <span v-else class="px-2 text-[11px] text-warning"> 待上传 </span>
          </template>
          <img
            v-else-if="asset.url"
            :src="asset.url"
            :alt="asset.label"
            class="max-size-full object-contain"
          />
          <DefaultBrandMark v-else class="size-1/2 text-muted-foreground/70" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="m-0 text-sm text-foreground font-600">{{ asset.label }}</h3>
            <span
              class="rounded-full px-2 py-0.5 text-[11px]"
              :class="
                asset.purpose === 'LOGO'
                  ? logoBadge(asset.url).className
                  : asset.url
                    ? 'bg-success/12 text-success'
                    : 'bg-muted text-muted-foreground'
              "
            >
              {{
                asset.purpose === 'LOGO'
                  ? logoBadge(asset.url).text
                  : asset.url
                    ? '已上传'
                    : '平台默认'
              }}
            </span>
          </div>
          <p v-if="asset.primary" class="m-0 mt-0.5 text-xs text-muted-foreground">
            PNG / SVG · 宽高比 1:1–12:1 · ≤2 MiB
          </p>
          <p v-else-if="asset.purpose === 'MARK'" class="m-0 mt-0.5 text-xs text-muted-foreground">
            PNG 32–512 px / SVG · 正方形 · ≤2 MiB
          </p>
          <p v-else class="m-0 mt-0.5 text-xs text-muted-foreground">
            PNG 16–512 px / 标准 ICO · 正方形 · ≤2 MiB
          </p>
        </div>
        <div class="flex items-center gap-2">
          <label
            v-if="assetControlsEnabled(asset.purpose)"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground transition-colors-150 hover:bg-accent"
            :class="busy ? 'pointer-events-none opacity-50' : ''"
          >
            <Icon icon="lucide:upload" class="size-3.5" />
            {{ asset.url ? '替换' : '上传' }}
            <input
              type="file"
              :accept="asset.accept"
              class="sr-only"
              :disabled="busy"
              @change="onUpload(asset.purpose, $event)"
            />
          </label>
          <Button
            v-if="removeEnabled(asset.purpose, asset.url)"
            size="sm"
            variant="ghost"
            color="destructive"
            :disabled="busy"
            @click="emit('remove', asset.purpose)"
          >
            移除
          </Button>
        </div>
      </article>
    </div>
  </section>
</template>
