<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import {
  workspaceLayoutModes,
  workspaceLayoutModeLabels,
  workspaceSidebarVariants,
  workspaceSidebarVariantLabels,
  workspaceBrandPlacements,
  workspaceBrandPlacementLabels,
  supportsWorkspaceBrandPlacement,
  type WorkspaceSidebarVariant,
} from '@jingwei/module-branding/shared'
import { Button, InputNumber, Segment, Select, Separator, Switch } from '@jingwei/ui'
import type { SegmentOptionData, SelectSingleOptionData } from '@jingwei/ui'

import LayoutModePreview from '../../../../components/layout-mode-preview.vue'
import {
  defaultAppearancePreferences,
  themeSizePreferences,
  useAppearanceStore,
  type ThemeSizePreference,
} from '../../../../stores/appearance.js'
import { useLayoutStore, type BrandPlacement, type LayoutMode } from '../../../../stores/layout.js'

const appearance = useAppearanceStore()
const { preferences: appearancePreferences } = storeToRefs(appearance)
const layout = useLayoutStore()
const { preferences, userOverrides, hasOverrides } = storeToRefs(layout)
const hasCustomSettings = computed(
  () =>
    hasOverrides.value || appearancePreferences.value.size !== defaultAppearancePreferences.size,
)

const sizeLabels: Record<ThemeSizePreference, string> = {
  xs: '紧凑',
  sm: '偏小',
  md: '标准',
  lg: '偏大',
  xl: '大',
  '2xl': '特大',
}
const sizeOptions: SelectSingleOptionData<ThemeSizePreference>[] = themeSizePreferences.map(
  (value) => ({ value, label: sizeLabels[value] }),
)

function setSize(value: unknown): void {
  const size = themeSizePreferences.find((size) => size === value)
  if (size !== undefined) appearance.patch({ size })
}

function resetSettings(): void {
  layout.reset()
  appearance.patch({ size: defaultAppearancePreferences.size })
}

const headerLimits = { min: 48, max: 96, step: 4 }
const siderLimits = { min: 192, max: 360, step: 8 }

const modeOptions = workspaceLayoutModes.map((value) => ({
  value,
  label: `${workspaceLayoutModeLabels[value]}模式`,
}))

const brandOptions = computed<SegmentOptionData<BrandPlacement>[]>(() =>
  workspaceBrandPlacements.map((value) => ({
    value,
    label: workspaceBrandPlacementLabels[value],
    disabled: !supportsWorkspaceBrandPlacement(preferences.value.mode, value),
  })),
)
const displayedBrandPlacement = computed(() =>
  supportsWorkspaceBrandPlacement(preferences.value.mode, preferences.value.brandPlacement)
    ? preferences.value.brandPlacement
    : 'header',
)
const sidebarVariantOptions: SegmentOptionData<WorkspaceSidebarVariant>[] =
  workspaceSidebarVariants.map((value) => ({ value, label: workspaceSidebarVariantLabels[value] }))
function setSidebarVariant(value: WorkspaceSidebarVariant | null): void {
  if (value !== null) layout.patch({ sidebarVariant: value })
}

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
  <form class="grid gap-6" @submit.prevent>
    <section class="grid gap-3">
      <Separator align="center">界面设置</Separator>
      <div class="flex items-center justify-between gap-4 px-1">
        <label for="workspace-size" class="text-sm text-foreground">界面密度</label>
        <Select
          id="workspace-size"
          :model-value="appearancePreferences.size"
          :items="sizeOptions"
          size="sm"
          class="w-28"
          @update:model-value="setSize"
        />
      </div>
    </section>
    <section class="grid gap-5">
      <Separator align="center">布局模式</Separator>
      <div class="grid grid-cols-3 gap-x-3 gap-y-3" role="radiogroup" aria-label="布局模式">
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
            <LayoutModePreview :mode="option.value" />
          </span>
          <span
            class="text-center text-xs font-medium"
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
        <span class="text-sm text-foreground"
          >侧栏样式<small v-if="'sidebarVariant' in userOverrides" class="ml-1 text-primary"
            >已自定义</small
          ></span
        >
        <Segment
          :model-value="preferences.sidebarVariant"
          :items="sidebarVariantOptions"
          size="sm"
          aria-label="侧栏样式"
          @update:model-value="setSidebarVariant"
        />
      </div>
      <div v-if="preferences.mode !== 'top'" class="flex items-center justify-between gap-4 px-1">
        <span class="text-sm text-foreground">
          侧边栏宽度
          <small v-if="'siderWidth' in userOverrides" class="ml-1 text-primary">已自定义</small>
        </span>
        <InputNumber
          :model-value="preferences.siderWidth"
          :min="siderLimits.min"
          :max="siderLimits.max"
          :disabled="preferences.mode !== 'left'"
          :step="siderLimits.step"
          :step-snapping="false"
          center
          size="sm"
          class="w-28"
          aria-label="Sider 宽度"
          @update:model-value="setSiderWidth"
        />
      </div>
      <div
        v-if="preferences.mode !== 'top'"
        class="flex flex-wrap items-center justify-between gap-4 px-1"
      >
        <span class="text-sm text-foreground">
          品牌位置
          <small v-if="'brandPlacement' in userOverrides" class="ml-1 text-primary">已自定义</small>
        </span>
        <Segment
          :model-value="displayedBrandPlacement"
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
        :disabled="!hasCustomSettings"
        @click="resetSettings"
      >
        恢复默认设置
      </Button>
    </div>
  </form>
</template>
