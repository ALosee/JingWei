<script setup lang="ts">
import { computed } from 'vue'

import { Button, Icon, Select } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import {
  resolveHorizontalBrandMode,
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
  hint: string
  url: string | null
  frameClass: string
  accept: string
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

const horizontalModeItems: SelectSingleOptionData<HorizontalBrandMode>[] = [
  { value: 'PLATFORM_WORDMARK', label: '平台内置字标' },
  { value: 'SHORT_NAME', label: '系统简称' },
  { value: 'CUSTOM_LOGO', label: '自定义横向 Logo' },
]
const logoColorModeItems: SelectSingleOptionData<LogoColorMode>[] = [
  { value: 'ORIGINAL', label: '保持原始颜色' },
  { value: 'FOLLOW_THEME', label: '单色跟随主题色' },
]
const resolvedHorizontalMode = computed(() =>
  resolveHorizontalBrandMode(props.horizontalBrandMode, props.logoUrl),
)

const assets = computed<AssetSlot[]>(() => [
  {
    purpose: 'LOGO',
    label: '横向 Logo',
    hint: '支持 PNG 或严格安全子集 SVG · 宽高比 1:1–12:1 · 小于 512 KiB',
    url: props.logoUrl,
    frameClass: 'h-14 w-36',
    accept: 'image/png,image/svg+xml,.svg',
  },
  {
    purpose: 'MARK',
    label: '方形标志',
    hint: '紧凑场景与预览占位 · 32–512 像素正方形',
    url: props.markUrl,
    frameClass: 'size-14',
    accept: 'image/png',
  },
  {
    purpose: 'FAVICON',
    label: 'Favicon',
    hint: '浏览器标签页图标 · 32–512 像素正方形',
    url: props.faviconUrl,
    frameClass: 'size-10',
    accept: 'image/png',
  },
])

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
  if (value === 'PLATFORM_WORDMARK' || value === 'SHORT_NAME' || value === 'CUSTOM_LOGO')
    emit('updateHorizontalBrandMode', value)
}

function onLogoColorModeChange(value: unknown): void {
  if (value === 'ORIGINAL' || value === 'FOLLOW_THEME') emit('updateLogoColorMode', value)
}
</script>

<template>
  <section class="grid gap-4 rounded-lg border border-border bg-card p-5">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="m-0 flex items-center gap-2 text-base text-foreground font-650">
          <Icon icon="lucide:image" class="size-4 text-muted-foreground" />
          品牌素材
        </h2>
        <p class="mb-0 mt-1 text-sm text-muted-foreground">
          横向 Logo 支持 PNG 和安全 SVG；方形标志与 Favicon 使用
          PNG。上传后需保存草稿，再发布才会生效。
        </p>
      </div>
    </header>

    <div class="grid gap-3 rounded-lg border border-border/80 bg-muted/20 p-3 md:grid-cols-2">
      <label class="grid gap-1.5 text-sm">
        <span class="font-600">横向品牌显示</span>
        <Select
          :model-value="horizontalBrandMode"
          :items="horizontalModeItems"
          :disabled="readOnly || !canManage"
          @update:model-value="onHorizontalBrandModeChange"
        />
        <span class="text-xs text-muted-foreground">
          可随时在平台字标、系统简称和上传的 Logo 之间切换。
        </span>
      </label>
      <label class="grid gap-1.5 text-sm">
        <span class="font-600">自定义 Logo 颜色</span>
        <Select
          :model-value="logoColorMode"
          :items="logoColorModeItems"
          :disabled="readOnly || !canManage || horizontalBrandMode !== 'CUSTOM_LOGO'"
          @update:model-value="onLogoColorModeChange"
        />
        <span class="text-xs text-muted-foreground">
          单色模式按素材透明轮廓着色，可自动适配亮色与暗色背景，但会忽略素材原有颜色。
        </span>
      </label>
    </div>

    <div class="grid gap-3">
      <article
        v-for="asset in assets"
        :key="asset.purpose"
        class="flex flex-wrap items-center gap-4 rounded-lg border border-border/80 bg-muted/20 p-3"
      >
        <div
          class="grid shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-background"
          :class="asset.frameClass"
        >
          <BrandLogoAsset
            v-if="asset.purpose === 'LOGO' && asset.url"
            :src="asset.url"
            :color-mode="logoColorMode"
            class="size-full"
          />
          <img
            v-else-if="asset.url"
            :src="asset.url"
            :alt="asset.label"
            class="max-size-full object-contain"
          />
          <DefaultBrandWordmark
            v-else-if="asset.purpose === 'LOGO' && resolvedHorizontalMode === 'PLATFORM_WORDMARK'"
            class="h-4 max-w-28 text-primary"
          />
          <span
            v-else-if="asset.purpose === 'LOGO'"
            class="px-2 text-sm text-muted-foreground font-650 tracking-wide"
          >
            {{ shortName || '—' }}
          </span>
          <DefaultBrandMark
            v-else-if="asset.purpose === 'MARK' || asset.purpose === 'FAVICON'"
            class="size-1/2 text-muted-foreground/70"
          />
          <span v-else class="text-[10px] tracking-wide text-muted-foreground uppercase">
            {{ asset.purpose }}
          </span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h3 class="m-0 text-sm text-foreground font-600">{{ asset.label }}</h3>
            <span
              class="rounded-full px-2 py-0.5 text-[11px]"
              :class="asset.url ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground'"
            >
              {{ asset.url ? '已上传' : '使用默认' }}
            </span>
          </div>
          <p class="m-0 mt-1 text-xs text-muted-foreground">{{ asset.hint }}</p>
        </div>
        <div class="flex items-center gap-2">
          <label
            v-if="!readOnly && canManage"
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
            v-if="asset.url && !readOnly && canManage"
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
