<script setup lang="ts">
import { computed, ref } from 'vue'

import { AppShell, Icon, Segment, ThemeScope } from '@jingwei/ui'
import type { SegmentOptionData } from '@jingwei/ui'

import {
  resolveHorizontalBrandMode,
  workspaceLayoutModeLabels,
  workspaceLogoPlacement,
  type BrandConfiguration,
} from '../../shared/index.js'
import { brandThemeOptions } from '../brand-theme.js'
import { platformDefaultFavicon } from '../platform-brand.js'
import BrandLogoAsset from './brand-logo-asset.vue'
import BrandingPreviewViewport from './branding-preview-viewport.vue'
import DefaultBrandMark from './default-brand-mark.vue'
import DefaultBrandWordmark from './default-brand-wordmark.vue'

const props = defineProps<{
  preview: BrandConfiguration
  logoUrl: string | null
  markUrl: string | null
  faviconUrl: string | null
  state: 'DRAFT' | 'SNAPSHOT' | 'PLATFORM_DEFAULT'
}>()

type PreviewSurface = 'workspace' | 'login'
type PreviewMode = 'light' | 'dark'

const surface = ref<PreviewSurface>('workspace')
const previewItems = [
  {
    value: 'workspace',
    label: '工作区',
    icon: 'lucide:panels-top-left',
    children: [
      {
        value: 'system',
        label: '系统管理',
        icon: 'lucide:settings',
        children: [{ value: 'brand', label: '品牌定制', icon: 'lucide:palette' }],
      },
    ],
  },
]
const previewTabs = [{ value: 'brand', label: '品牌定制', hidePinnedIcon: true, draggable: false }]
const previewLayoutProps = computed(() => ({
  variant: props.preview.workspaceDefaults.sidebarVariant,
  headerHeight: props.preview.workspaceDefaults.headerHeight,
  tabVisible: props.preview.workspaceDefaults.showTabs,
  footerVisible: false,
  ...(props.preview.workspaceDefaults.layoutMode === 'left'
    ? { sidebarWidth: props.preview.workspaceDefaults.siderWidth }
    : {}),
}))
const previewLogoPlacement = computed(() =>
  workspaceLogoPlacement(props.preview.workspaceDefaults.brandPlacement),
)

const previewMode = ref<PreviewMode>('light')
const surfaceItems: SegmentOptionData<PreviewSurface>[] = [
  { value: 'workspace', label: '工作区' },
  { value: 'login', label: '登录页' },
]
const modeItems: SegmentOptionData<PreviewMode>[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

const browserTitle = computed(() =>
  props.preview.titleMode === 'SYSTEM_ONLY'
    ? props.preview.systemName
    : `工作区 · ${props.preview.systemName}`,
)
const previewTheme = computed(() => brandThemeOptions(props.preview.visualTheme))
const horizontalMode = computed(() =>
  resolveHorizontalBrandMode(props.preview.horizontalBrandMode, props.logoUrl),
)
const stateHint = computed(() => {
  if (props.state === 'SNAPSHOT') return '历史快照，非当前线上'
  if (props.state === 'PLATFORM_DEFAULT') return '平台内置，未发布租户品牌'
  return '预览当前草稿，发布后线上生效'
})
const horizontalLabel = computed(() => {
  if (horizontalMode.value === 'CUSTOM_LOGO')
    return `横向 Logo（${props.preview.logoColorMode === 'FOLLOW_THEME' ? '单色跟随主题' : '保持原色'}）`
  if (horizontalMode.value === 'PLATFORM_WORDMARK') return '平台内置字标'
  return props.preview.shortName || props.preview.systemName
})
</script>

<template>
  <section class="min-w-0 grid content-start gap-3" data-brand-live-preview>
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="m-0 text-sm font-semibold text-foreground">实时预览</h2>
      <p class="m-0 text-xs text-muted-foreground">{{ stateHint }}</p>
    </header>

    <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <Segment v-model="surface" :items="surfaceItems" size="sm" fill="full" class="w-full" />
      <Segment v-model="previewMode" :items="modeItems" size="sm" />
    </div>

    <ThemeScope
      :theme="previewTheme"
      :mode="previewMode"
      class="overflow-hidden rounded-xl border border-border bg-background shadow-sm"
    >
      <div class="flex items-center gap-2 border-b border-border bg-muted/70 px-3 py-2">
        <div class="flex gap-1.5" aria-hidden="true">
          <span class="size-2.5 rounded-full bg-destructive/50" />
          <span class="size-2.5 rounded-full bg-warning/50" />
          <span class="size-2.5 rounded-full bg-success/50" />
        </div>
        <div
          class="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border/70 bg-background px-2 py-1"
        >
          <img
            :src="faviconUrl ?? platformDefaultFavicon.href"
            alt=""
            class="size-3.5 rounded-sm object-contain"
            data-brand-preview-favicon
          />
          <span class="truncate text-xs text-muted-foreground">{{ browserTitle }}</span>
        </div>
      </div>

      <BrandingPreviewViewport>
        <ThemeScope
          :theme="previewTheme"
          :mode="previewMode"
          class="h-full bg-background text-foreground"
        >
          <!-- Workspace -->
          <AppShell
            v-if="surface === 'workspace'"
            class="h-full"
            layout-scope="preview"
            :mode="
              preview.workspaceDefaults.layoutMode === 'left'
                ? 'sidebar'
                : preview.workspaceDefaults.layoutMode
            "
            :items="previewItems"
            model-value="brand"
            :is-mobile="false"
            :layout-props="previewLayoutProps"
            :logo-placement="previewLogoPlacement"
            :tabs="previewTabs"
            tab-value="brand"
            :tab-props="{ beforeClose: () => false }"
          >
            <template #logo>
              <span
                class="size-8 grid shrink-0 place-items-center"
                :class="
                  markUrl
                    ? 'overflow-visible'
                    : 'overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm'
                "
              >
                <img v-if="markUrl" :src="markUrl" alt="" class="size-full object-contain" />
                <DefaultBrandMark v-else class="size-6" />
              </span>
            </template>
            <template #title>
              <BrandLogoAsset
                v-if="horizontalMode === 'CUSTOM_LOGO' && logoUrl"
                :src="logoUrl"
                :color-mode="preview.logoColorMode"
                class="h-5 min-w-0 flex-1 object-contain object-left"
              />
              <DefaultBrandWordmark
                v-else-if="horizontalMode === 'PLATFORM_WORDMARK'"
                class="h-3.5 min-w-0 max-w-28 flex-1 text-primary"
              />
              <strong v-else class="truncate text-sm">{{
                preview.shortName || preview.systemName
              }}</strong>
            </template>
            <div class="grid content-center gap-2.5 bg-card/40 p-5">
              <span class="text-[11px] text-primary font-650 tracking-wide uppercase">
                Enterprise workspace
              </span>
              <h3 class="m-0 text-xl text-foreground font-700 leading-snug">
                {{ preview.systemName }}
              </h3>
              <div class="grid gap-1.5">
                <div class="h-8 rounded-md border border-border/70 bg-background/80" />
                <div class="h-8 rounded-md border border-border/70 bg-background/80" />
                <div class="h-8 rounded-md bg-primary/85" />
              </div>
            </div>
          </AppShell>

          <!-- Login -->
          <div
            v-else
            class="grid h-full place-items-center bg-gradient-to-br from-primary/12 to-background p-5"
          >
            <div class="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-sm">
              <div class="flex items-center gap-2.5">
                <span
                  class="size-9 grid shrink-0 place-items-center"
                  :class="
                    markUrl
                      ? 'overflow-visible'
                      : 'overflow-hidden rounded-lg bg-primary/12 text-primary'
                  "
                >
                  <img v-if="markUrl" :src="markUrl" alt="" class="size-full object-contain" />
                  <DefaultBrandMark v-else class="size-6" />
                </span>
                <BrandLogoAsset
                  v-if="horizontalMode === 'CUSTOM_LOGO' && logoUrl"
                  :src="logoUrl"
                  :color-mode="preview.logoColorMode"
                  class="h-5 min-w-0 flex-1 object-contain object-left"
                />
                <DefaultBrandWordmark
                  v-else-if="horizontalMode === 'PLATFORM_WORDMARK'"
                  class="h-3.5 min-w-0 max-w-32 flex-1 text-primary"
                />
                <strong v-else class="truncate text-sm text-foreground">{{
                  preview.shortName || preview.systemName
                }}</strong>
              </div>
              <h3 class="mb-0 mt-5 text-xl text-foreground font-700 leading-snug">
                {{ preview.loginTitle || preview.systemName }}
              </h3>
              <p class="mb-0 mt-2 text-sm text-muted-foreground leading-relaxed">
                {{ preview.loginTagline || '尚未填写登录页说明。' }}
              </p>
              <div class="mt-4 grid gap-2">
                <div class="h-8 rounded-md border border-border/70 bg-background" />
                <div class="h-8 rounded-md border border-border/70 bg-background" />
                <div class="h-8 rounded-md bg-primary/90" />
              </div>
            </div>
          </div>
        </ThemeScope>
      </BrandingPreviewViewport>
    </ThemeScope>

    <ul class="m-0 grid gap-1 p-0 list-none text-xs text-muted-foreground">
      <li class="flex items-center gap-1.5">
        <Icon icon="lucide:monitor" class="size-3.5" />
        浏览器标题：{{ browserTitle }}
      </li>
      <li class="flex items-center gap-1.5">
        <Icon icon="lucide:panel-left" class="size-3.5" />
        横向品牌位：{{ horizontalLabel }}
      </li>
      <li class="flex items-center gap-1.5">
        <Icon icon="lucide:panels-top-left" class="size-3.5" />
        默认布局：{{ workspaceLayoutModeLabels[preview.workspaceDefaults.layoutMode] }}，{{
          preview.workspaceDefaults.showTabs ? '显示标签栏' : '隐藏标签栏'
        }}
      </li>
    </ul>
  </section>
</template>
