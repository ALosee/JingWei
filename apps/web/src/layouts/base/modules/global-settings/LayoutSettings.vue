<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { Button, InputNumber, Segment, Separator, Switch } from '@jingwei/ui'
import type { SegmentOptionData } from '@jingwei/ui'

import { useLayoutStore, type BrandPlacement, type LayoutMode } from '../../../../stores/layout.js'

const layout = useLayoutStore()
const { preferences, tenantDefaults, userOverrides, hasOverrides } = storeToRefs(layout)

const headerLimits = { min: 48, max: 96, step: 4 }
const siderLimits = { min: 192, max: 360, step: 8 }

const modeOptions: { value: LayoutMode; label: string }[] = [
  { value: 'left', label: '左侧菜单模式' },
  { value: 'top', label: '顶部菜单模式' },
]

const brandOptions: SegmentOptionData<BrandPlacement>[] = [
  { value: 'header', label: '顶栏' },
  { value: 'sider', label: '侧栏' },
]

function setMode(mode: LayoutMode): void {
  layout.patch({ mode })
}

function setBrandPlacement(value: BrandPlacement | null): void {
  if (value == null) return
  layout.patch({ brandPlacement: value })
}

function setHeaderHeight(value: number | null): void {
  if (value == null || !Number.isFinite(value)) return
  layout.patch({ headerHeight: value })
}

function setSiderWidth(value: number | null): void {
  if (value == null || !Number.isFinite(value)) return
  layout.patch({ siderWidth: value })
}

function setShowTabs(value: boolean): void {
  layout.patch({ showTabs: value })
}
</script>

<template>
  <form class="grid gap-6 pt-2" @submit.prevent>
    <p class="m-0 text-xs text-muted-foreground">
      当前租户默认使用{{ tenantDefaults.mode === 'left' ? '左侧' : '顶部' }}菜单、{{
        tenantDefaults.showTabs ? '显示' : '隐藏'
      }}标签栏。未单独调整的项目会继续跟随租户默认值。
    </p>
    <section class="grid gap-5">
      <Separator align="center">布局模式</Separator>
      <div class="grid grid-cols-2 gap-x-4 gap-y-3" role="radiogroup" aria-label="布局模式">
        <button
          v-for="option in modeOptions"
          :key="option.value"
          type="button"
          role="radio"
          class="group flex flex-col items-center gap-1.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-primary/30"
          :aria-checked="preferences.mode === option.value"
          @click="setMode(option.value)"
        >
          <span
            class="flex h-18 w-full gap-1 border-2 rounded-lg p-1 transition-colors"
            :class="
              preferences.mode === option.value
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card group-hover:border-primary/40'
            "
            aria-hidden="true"
          >
            <template v-if="option.value === 'left'">
              <span class="w-1/3 rounded-sm bg-primary/80" />
              <span class="flex flex-1 flex-col gap-1">
                <span class="h-1/3 rounded-sm bg-primary/80" />
                <span class="flex-1 rounded-sm bg-primary/30" />
              </span>
            </template>
            <template v-else>
              <span class="flex h-full w-full flex-col gap-1">
                <span class="h-1/3 rounded-sm bg-primary/80" />
                <span class="flex-1 rounded-sm bg-primary/30" />
              </span>
            </template>
          </span>
          <span
            class="text-xs font-medium"
            :class="preferences.mode === option.value ? 'text-primary' : 'text-foreground'"
          >
            {{ option.label }}
          </span>
        </button>
      </div>
    </section>

    <section class="grid gap-3">
      <Separator align="center">标签栏设置</Separator>
      <div class="flex items-center justify-between gap-4 px-1">
        <span class="text-sm text-foreground">
          显示标签栏
          <small v-if="'showTabs' in userOverrides" class="ml-1 text-primary">已自定义</small>
        </span>
        <Switch
          :model-value="preferences.showTabs"
          :control-props="{ 'aria-label': '显示页面标签' }"
          @update:model-value="setShowTabs"
        />
      </div>
    </section>

    <section class="grid gap-3">
      <Separator align="center">头部设置</Separator>
      <div class="flex items-center justify-between gap-4 px-1">
        <span class="text-sm text-foreground">
          头部高度
          <small v-if="'headerHeight' in userOverrides" class="ml-1 text-primary">已自定义</small>
        </span>
        <InputNumber
          :model-value="preferences.headerHeight"
          :min="headerLimits.min"
          :max="headerLimits.max"
          :step="headerLimits.step"
          :step-snapping="false"
          center
          size="sm"
          class="w-28"
          aria-label="Header 高度"
          @update:model-value="setHeaderHeight"
        />
      </div>
    </section>

    <section class="grid gap-3">
      <Separator align="center">侧边栏设置</Separator>
      <div class="flex items-center justify-between gap-4 px-1">
        <span class="text-sm text-foreground">
          侧边栏宽度
          <small v-if="'siderWidth' in userOverrides" class="ml-1 text-primary">已自定义</small>
        </span>
        <InputNumber
          :model-value="preferences.siderWidth"
          :min="siderLimits.min"
          :max="siderLimits.max"
          :step="siderLimits.step"
          :step-snapping="false"
          center
          size="sm"
          class="w-28"
          aria-label="Sider 宽度"
          @update:model-value="setSiderWidth"
        />
      </div>
      <div v-if="preferences.mode === 'left'" class="flex items-center justify-between gap-4 px-1">
        <span class="text-sm text-foreground">
          品牌位置
          <small v-if="'brandPlacement' in userOverrides" class="ml-1 text-primary">已自定义</small>
        </span>
        <Segment
          :model-value="preferences.brandPlacement"
          :items="brandOptions"
          size="sm"
          @update:model-value="setBrandPlacement"
        />
      </div>
    </section>

    <div class="flex justify-start border-t border-border pt-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        :disabled="!hasOverrides"
        @click="layout.reset"
      >
        恢复租户默认
      </Button>
    </div>
  </form>
</template>
