<script setup lang="ts">
import { InputNumber, Segment, Switch } from '@jingwei/ui'
import type { SegmentOptionData } from '@jingwei/ui'

import type {
  BrandWorkspaceDefaults,
  WorkspaceBrandPlacement,
  WorkspaceLayoutMode,
} from '../../shared/index.js'

const props = defineProps<{
  modelValue: BrandWorkspaceDefaults
  disabled: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: BrandWorkspaceDefaults]
}>()

const layoutOptions: SegmentOptionData<WorkspaceLayoutMode>[] = [
  { value: 'left', label: '左侧菜单' },
  { value: 'top', label: '顶部菜单' },
]
const brandPlacementOptions: SegmentOptionData<WorkspaceBrandPlacement>[] = [
  { value: 'header', label: '顶栏' },
  { value: 'sider', label: '侧栏' },
]

function patch<Key extends keyof BrandWorkspaceDefaults>(
  key: Key,
  value: BrandWorkspaceDefaults[Key],
): void {
  if (!props.disabled) emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function setLayoutMode(value: WorkspaceLayoutMode | null): void {
  if (value !== null) patch('layoutMode', value)
}

function setBrandPlacement(value: WorkspaceBrandPlacement | null): void {
  if (value !== null) patch('brandPlacement', value)
}

function setHeaderHeight(value: number | null): void {
  if (value !== null && Number.isFinite(value)) patch('headerHeight', value)
}

function setSiderWidth(value: number | null): void {
  if (value !== null && Number.isFinite(value)) patch('siderWidth', value)
}

function setShowTabs(value: boolean): void {
  patch('showTabs', value)
}
</script>

<template>
  <section class="grid gap-4">
    <header>
      <h2 class="m-0 text-sm font-semibold text-foreground">工作区默认布局</h2>
      <p class="mb-0 mt-1 text-xs text-muted-foreground">
        未做个人调整的用户采用这些默认值；用户仍可在工作区设置中覆盖
      </p>
    </header>

    <div class="grid gap-x-8 gap-y-4 lg:grid-cols-[8rem_minmax(0,1fr)] lg:items-center">
      <span class="text-sm font-500 text-foreground">菜单模式</span>
      <Segment
        :model-value="modelValue.layoutMode"
        :items="layoutOptions"
        :disabled="disabled"
        class="w-full max-w-md"
        @update:model-value="setLayoutMode"
      />

      <span class="text-sm font-500 text-foreground">品牌位置</span>
      <div class="grid gap-1">
        <Segment
          :model-value="modelValue.brandPlacement"
          :items="brandPlacementOptions"
          :disabled="disabled || modelValue.layoutMode === 'top'"
          class="w-full max-w-md"
          @update:model-value="setBrandPlacement"
        />
        <small v-if="modelValue.layoutMode === 'top'" class="text-muted-foreground">
          顶部菜单模式固定在顶栏显示品牌，切回左侧菜单后恢复此设置。
        </small>
      </div>

      <label class="text-sm font-500 text-foreground">头部高度</label>
      <InputNumber
        :model-value="modelValue.headerHeight"
        :min="48"
        :max="96"
        :step="4"
        :step-snapping="false"
        :disabled="disabled"
        center
        class="w-32"
        @update:model-value="setHeaderHeight"
      />

      <label class="text-sm font-500 text-foreground">侧栏宽度</label>
      <InputNumber
        :model-value="modelValue.siderWidth"
        :min="192"
        :max="360"
        :step="8"
        :step-snapping="false"
        :disabled="disabled"
        center
        class="w-32"
        @update:model-value="setSiderWidth"
      />

      <span class="text-sm font-500 text-foreground">显示标签栏</span>
      <Switch
        :model-value="modelValue.showTabs"
        :disabled="disabled"
        :control-props="{ 'aria-label': '默认显示页面标签栏' }"
        @update:model-value="setShowTabs"
      />
    </div>
  </section>
</template>
