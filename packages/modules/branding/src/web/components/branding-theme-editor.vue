<script setup lang="ts">
import { computed, ref } from 'vue'

import { Segment, Select } from '@jingwei/ui'
import type { SegmentOptionData, SelectSingleOptionData } from '@jingwei/ui'

import { validateBrandTheme } from '../../shared/brand-theme-validation.js'
import {
  brandChartSchemes,
  brandFeedbackSchemes,
  brandRadiusOptions,
  brandSidebarSchemes,
  type BrandVisualTheme,
} from '../../shared/index.js'
import BrandingPaletteCard from './branding-palette-card.vue'
import BrandingSemanticThemeEditor from './branding-semantic-theme-editor.vue'

const props = defineProps<{ modelValue: BrandVisualTheme; disabled: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: BrandVisualTheme] }>()
const themeIssues = computed(() => validateBrandTheme(props.modelValue))

type EditorSection = 'base' | 'primary' | 'appearance' | 'semantic'
const section = ref<EditorSection>('base')
const sectionItems: SegmentOptionData<EditorSection>[] = [
  { value: 'base', label: '基础中性色' },
  { value: 'primary', label: '品牌主色' },
  { value: 'appearance', label: '界面风格' },
  { value: 'semantic', label: '高级语义色' },
]
const mode = ref<'light' | 'dark'>('light')
const modeItems: SegmentOptionData<'light' | 'dark'>[] = [
  { value: 'light', label: '浅色应用色' },
  { value: 'dark', label: '深色应用色' },
]
const radiusLabels = {
  '2xs': '极小',
  xs: '较小',
  sm: '小',
  md: '标准',
  lg: '大',
  xl: '较大',
  '2xl': '圆润',
} as const
const sidebarLabels = {
  derived: '跟随基础色',
  'inverted-dark': '深色反转',
  soft: '柔和',
  contrast: '高对比',
} as const
const feedbackLabels = {
  classic: '经典',
  vivid: '鲜明',
  subtle: '柔和',
  modern: '现代',
  professional: '专业',
} as const
const chartLabels = {
  vivid: '鲜明',
  cool: '冷色',
  warm: '暖色',
  natural: '自然',
  minimal: '简约',
} as const

const radiusOptions = brandRadiusOptions.map((value) => ({ value, label: radiusLabels[value] }))
const sidebarOptions = brandSidebarSchemes.map((value) => ({
  value,
  label: sidebarLabels[value],
}))
const feedbackOptions = brandFeedbackSchemes.map((value) => ({
  value,
  label: feedbackLabels[value],
}))
const chartOptions = brandChartSchemes.map((value) => ({ value, label: chartLabels[value] }))
const lightLevelOptions: SelectSingleOptionData<number>[] = [
  { value: 0, label: '明亮' },
  { value: 1, label: '轻微压暗' },
  { value: 2, label: '明显压暗' },
]
const darkLevelOptions: SelectSingleOptionData<number>[] = [
  { value: 0, label: '深邃' },
  { value: 1, label: '轻微提亮' },
  { value: 2, label: '中度提亮' },
  { value: 3, label: '明显提亮' },
]
const borderOpacityOptions: SelectSingleOptionData<number>[] = [
  { value: 0.35, label: '极弱' },
  { value: 0.55, label: '柔和' },
  { value: 0.75, label: '清晰' },
  { value: 1, label: '完整' },
]

function update(patch: Partial<BrandVisualTheme>): void {
  if (!props.disabled) emit('update:modelValue', { ...props.modelValue, ...patch })
}

function selectEnum<const Values extends readonly string[]>(
  values: Values,
  value: unknown,
  apply: (value: Values[number]) => void,
): void {
  if (typeof value === 'string' && isOneOf(values, value)) apply(value)
}

function isOneOf<const Values extends readonly string[]>(
  values: Values,
  value: string,
): value is Values[number] {
  return values.some((candidate) => candidate === value)
}

function selectNumber(
  values: readonly number[],
  value: unknown,
  apply: (value: number) => void,
): void {
  if (typeof value === 'number' && values.includes(value)) apply(value)
}
</script>

<template>
  <section class="grid gap-4">
    <header>
      <h2 class="m-0 text-sm font-semibold text-foreground">主题工作室</h2>
      <p class="mb-0 mt-1 text-xs text-muted-foreground">
        租户统一发布色阶和语义角色；用户仍可选择浅色或深色显示偏好
      </p>
    </header>

    <div class="overflow-x-auto rounded-lg bg-muted/40 p-1">
      <Segment v-model="section" :items="sectionItems" fill="full" class="min-w-max w-full" />
    </div>

    <div
      v-if="themeIssues.length > 0"
      role="alert"
      class="rounded-md border border-warning/40 bg-warning/8 px-3 py-2 text-xs text-warning"
    >
      <p class="m-0 font-600">以下颜色组合在发布前需要调整：</p>
      <ul class="mb-0 mt-1 list-disc space-y-0.5 pl-4">
        <li v-for="issue in themeIssues" :key="issue">{{ issue }}</li>
      </ul>
      <p class="mb-0 mt-1.5">
        浅色选色可能改变深色的自动推导结果；请切换到对应角色的深色设置进行调整。
      </p>
    </div>

    <div v-if="section === 'base' || section === 'primary'" class="grid gap-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="m-0 text-xs text-muted-foreground">
          先选色系，再为具体角色选择深浅；浅色设置也可能影响深色自动结果。
        </p>
        <Segment v-model="mode" :items="modeItems" size="sm" />
      </div>
      <BrandingPaletteCard
        v-if="section === 'base'"
        :model-value="modelValue"
        target="base"
        :mode="mode"
        :disabled="disabled"
        @update:model-value="emit('update:modelValue', $event)"
        @update:mode="mode = $event"
      />
      <BrandingPaletteCard
        v-else
        :model-value="modelValue"
        target="primary"
        :mode="mode"
        :disabled="disabled"
        @update:model-value="emit('update:modelValue', $event)"
        @update:mode="mode = $event"
      />
    </div>

    <div
      v-else-if="section === 'appearance'"
      class="grid gap-x-8 gap-y-4 lg:grid-cols-[8rem_minmax(0,1fr)] lg:items-center"
    >
      <label class="text-sm font-500 text-foreground">组件圆角</label>
      <Select
        :model-value="modelValue.radius"
        :items="radiusOptions"
        :disabled="disabled"
        class="w-full max-w-md"
        @update:model-value="
          selectEnum(brandRadiusOptions, $event, (value) => update({ radius: value }))
        "
      />

      <label class="text-sm font-500 text-foreground">侧栏配色</label>
      <Select
        :model-value="modelValue.sidebarScheme"
        :items="sidebarOptions"
        :disabled="disabled"
        class="w-full max-w-md"
        @update:model-value="
          selectEnum(brandSidebarSchemes, $event, (value) => update({ sidebarScheme: value }))
        "
      />

      <label class="text-sm font-500 text-foreground">状态色方案</label>
      <Select
        :model-value="modelValue.feedbackScheme"
        :items="feedbackOptions"
        :disabled="disabled"
        class="w-full max-w-md"
        @update:model-value="
          selectEnum(brandFeedbackSchemes, $event, (value) => update({ feedbackScheme: value }))
        "
      />

      <label class="text-sm font-500 text-foreground">图表色方案</label>
      <Select
        :model-value="modelValue.chartScheme"
        :items="chartOptions"
        :disabled="disabled"
        class="w-full max-w-md"
        @update:model-value="
          selectEnum(brandChartSchemes, $event, (value) => update({ chartScheme: value }))
        "
      />

      <label class="text-sm font-500 text-foreground">浅色表面深度</label>
      <Select
        :model-value="modelValue.lightLevel"
        :items="lightLevelOptions"
        :disabled="disabled"
        class="w-full max-w-md"
        @update:model-value="
          selectNumber([0, 1, 2], $event, (value) => update({ lightLevel: value as 0 | 1 | 2 }))
        "
      />

      <label class="text-sm font-500 text-foreground">深色表面深度</label>
      <Select
        :model-value="modelValue.darkLevel"
        :items="darkLevelOptions"
        :disabled="disabled"
        class="w-full max-w-md"
        @update:model-value="
          selectNumber([0, 1, 2, 3], $event, (value) =>
            update({ darkLevel: value as 0 | 1 | 2 | 3 }),
          )
        "
      />

      <label class="text-sm font-500 text-foreground">边界强度</label>
      <Select
        :model-value="modelValue.borderOpacity"
        :items="borderOpacityOptions"
        :disabled="disabled"
        class="w-full max-w-md"
        @update:model-value="
          selectNumber([0.35, 0.55, 0.75, 1], $event, (value) => update({ borderOpacity: value }))
        "
      />
    </div>

    <BrandingSemanticThemeEditor
      v-else
      :model-value="modelValue"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </section>
</template>
