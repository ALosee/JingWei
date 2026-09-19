<script setup lang="ts">
import { computed, ref } from 'vue'

import { Icon, Segment } from '@jingwei/ui'
import type { SegmentOptionData } from '@jingwei/ui'

import { resolveHorizontalBrandMode, type BrandConfiguration } from '../../shared/index.js'
import BrandLogoAsset from './brand-logo-asset.vue'
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

const surface = ref<PreviewSurface>('workspace')
const surfaceItems: SegmentOptionData<PreviewSurface>[] = [
  { value: 'workspace', label: '工作区' },
  { value: 'login', label: '登录页' },
]

const browserTitle = computed(() =>
  props.preview.titleMode === 'SYSTEM_ONLY'
    ? props.preview.systemName
    : `工作区 · ${props.preview.systemName}`,
)
const horizontalMode = computed(() =>
  resolveHorizontalBrandMode(props.preview.horizontalBrandMode, props.logoUrl),
)
const stateLabel = computed(() => {
  if (props.state === 'DRAFT') return '草稿编辑中'
  if (props.state === 'PLATFORM_DEFAULT') return '平台内置默认'
  return '只读快照'
})
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
  <section class="grid content-start gap-3">
    <header class="flex flex-wrap items-end justify-between gap-2">
      <div class="min-w-0">
        <h2 class="m-0 flex items-center gap-2 text-base text-foreground font-650">
          <Icon icon="lucide:eye" class="size-4 text-muted-foreground" />
          实时预览
        </h2>
        <p class="mb-0 mt-1 text-xs text-muted-foreground">{{ stateHint }}</p>
      </div>
      <span
        class="rounded-full px-2 py-0.5 text-xs"
        :class="
          state === 'DRAFT'
            ? 'bg-primary/12 text-primary'
            : state === 'SNAPSHOT'
              ? 'bg-warning/12 text-warning'
              : 'bg-muted text-muted-foreground'
        "
      >
        {{ stateLabel }}
      </span>
    </header>

    <Segment v-model="surface" :items="surfaceItems" size="sm" fill="full" class="w-full" />

    <div class="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div class="flex items-center gap-2 border-b border-border bg-muted/70 px-3 py-2">
        <div class="flex gap-1.5" aria-hidden="true">
          <span class="size-2.5 rounded-full bg-destructive/50" />
          <span class="size-2.5 rounded-full bg-warning/50" />
          <span class="size-2.5 rounded-full bg-success/50" />
        </div>
        <div
          class="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border/70 bg-background px-2 py-1"
        >
          <img v-if="faviconUrl" :src="faviconUrl" alt="" class="size-3.5 object-contain" />
          <span
            v-else
            class="size-3.5 grid place-items-center rounded-sm bg-primary/15 text-primary"
          >
            <DefaultBrandMark class="size-3" />
          </span>
          <span class="truncate text-xs text-muted-foreground">{{ browserTitle }}</span>
        </div>
      </div>

      <!-- Workspace -->
      <div v-if="surface === 'workspace'" class="grid min-h-64 md:grid-cols-[9.5rem_1fr]">
        <aside
          class="flex flex-col gap-4 border-r border-sidebar-border bg-sidebar p-3.5 text-sidebar-foreground"
        >
          <div class="flex items-center gap-2">
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
          </div>
          <nav class="grid gap-1 text-xs" aria-hidden="true">
            <span class="rounded-md bg-sidebar-primary/10 px-2 py-1.5 text-sidebar-primary">
              工作区
            </span>
            <span class="rounded-md px-2 py-1.5 opacity-75">系统管理</span>
            <span class="rounded-md px-2 py-1.5 opacity-75">品牌定制</span>
          </nav>
        </aside>
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
      </div>

      <!-- Login -->
      <div
        v-else
        class="grid min-h-64 place-items-center bg-gradient-to-br from-primary/12 to-background p-5"
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
    </div>

    <ul class="m-0 grid gap-1 p-0 list-none text-xs text-muted-foreground">
      <li class="flex items-center gap-1.5">
        <Icon icon="lucide:monitor" class="size-3.5" />
        浏览器标题：{{ browserTitle }}
      </li>
      <li class="flex items-center gap-1.5">
        <Icon icon="lucide:panel-left" class="size-3.5" />
        横向品牌位：{{ horizontalLabel }}
      </li>
    </ul>
  </section>
</template>
