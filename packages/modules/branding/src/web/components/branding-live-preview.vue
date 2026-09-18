<script setup lang="ts">
import { computed } from 'vue'

import { Icon } from '@jingwei/ui'

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
  return '版本快照'
})
</script>

<template>
  <section class="grid content-start gap-3">
    <header class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="m-0 flex items-center gap-2 text-base text-foreground font-650">
          <Icon icon="lucide:eye" class="size-4 text-muted-foreground" />
          实时预览
        </h2>
        <p class="mb-0 mt-1 text-sm text-muted-foreground">
          预览只反映当前编辑内容，不会改动线上品牌。
        </p>
      </div>
      <span
        class="rounded-full px-2 py-0.5 text-xs"
        :class="state === 'DRAFT' ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground'"
      >
        {{ stateLabel }}
      </span>
    </header>

    <div class="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <!-- Browser chrome -->
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

      <!-- Workspace shell -->
      <div class="grid min-h-72 md:grid-cols-[10.5rem_1fr]">
        <aside class="flex flex-col gap-5 bg-primary p-4 text-primary-foreground">
          <div class="flex items-center gap-2.5">
            <span
              class="size-9 grid shrink-0 place-items-center overflow-hidden rounded-lg bg-white/15 text-primary-foreground"
            >
              <img v-if="markUrl" :src="markUrl" alt="" class="size-full object-contain" />
              <DefaultBrandMark v-else class="size-7" />
            </span>
            <BrandLogoAsset
              v-if="horizontalMode === 'CUSTOM_LOGO' && logoUrl"
              :src="logoUrl"
              :color-mode="preview.logoColorMode"
              class="h-6 w-28 object-contain object-left"
            />
            <DefaultBrandWordmark
              v-else-if="horizontalMode === 'PLATFORM_WORDMARK'"
              class="h-4 min-w-0 max-w-36 flex-1 text-primary-foreground"
            />
            <strong v-else class="truncate text-sm">{{
              preview.shortName || preview.systemName
            }}</strong>
          </div>
          <nav class="grid gap-1 text-xs" aria-hidden="true">
            <span class="rounded-md bg-white/15 px-2 py-1.5">工作区</span>
            <span class="rounded-md px-2 py-1.5 opacity-75">系统管理</span>
            <span class="rounded-md px-2 py-1.5 opacity-75">品牌定制</span>
          </nav>
        </aside>

        <div class="grid content-center gap-3 bg-card/40 p-6">
          <span class="text-xs text-primary font-650 tracking-wide uppercase"
            >Enterprise workspace</span
          >
          <h3 class="m-0 text-2xl text-foreground font-700 leading-snug">
            {{ preview.loginTitle || preview.systemName }}
          </h3>
          <p class="m-0 max-w-prose text-sm text-muted-foreground leading-relaxed">
            {{ preview.loginTagline || '尚未填写登录页说明。' }}
          </p>
          <div class="mt-2 grid gap-2">
            <div class="h-9 rounded-md border border-border/70 bg-background/80" />
            <div class="h-9 rounded-md border border-border/70 bg-background/80" />
            <div class="h-9 rounded-md bg-primary/90" />
          </div>
        </div>
      </div>
    </div>

    <ul class="m-0 grid gap-1.5 p-0 list-none text-xs text-muted-foreground">
      <li class="flex items-center gap-1.5">
        <Icon icon="lucide:monitor" class="size-3.5" />
        浏览器标题：{{ browserTitle }}
      </li>
      <li class="flex items-center gap-1.5">
        <Icon icon="lucide:panel-left" class="size-3.5" />
        侧栏展示：{{
          horizontalMode === 'CUSTOM_LOGO'
            ? `横向 Logo（${preview.logoColorMode === 'FOLLOW_THEME' ? '单色跟随主题色' : '保持原色'}）`
            : horizontalMode === 'PLATFORM_WORDMARK'
              ? '平台内置字标'
              : preview.shortName || preview.systemName
        }}
      </li>
    </ul>
  </section>
</template>
