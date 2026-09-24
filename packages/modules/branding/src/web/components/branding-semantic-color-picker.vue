<script setup lang="ts">
import { generateNearestPalette } from '@soybeanjs/colord/palette'
import { computed, ref, watch } from 'vue'

import {
  ColorPicker,
  Segment,
  Switch,
  ThemePaletteSelect,
  generateThemePaletteColors,
  getThemePaletteColors,
  normalizeThemePaletteColor,
} from '@jingwei/ui'
import type { SegmentOptionData, ThemePaletteSelectItem } from '@jingwei/ui'

import {
  brandPaletteLevels,
  brandPrimaryPalettes,
  type BrandPaletteLevel,
  type BrandThemeColor,
  type BrandVisualTheme,
} from '../../shared/index.js'

const props = defineProps<{
  modelValue: BrandThemeColor
  theme: BrandVisualTheme
  disabled: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: BrandThemeColor] }>()

type ColorMode = 'palette' | 'custom' | 'simple'
type PaletteKey = Extract<BrandThemeColor, { kind: 'PALETTE' }>['palette']
const modeItems: SegmentOptionData<ColorMode>[] = [
  { value: 'palette', label: '色阶' },
  { value: 'custom', label: '自定义' },
  { value: 'simple', label: '基础色' },
]
const mode = ref<ColorMode>(
  props.modelValue.kind === 'PALETTE'
    ? 'palette'
    : props.modelValue.kind === 'LITERAL'
      ? 'custom'
      : 'simple',
)
const selectedPalette = ref<PaletteKey>(
  props.modelValue.kind === 'PALETTE' ? props.modelValue.palette : 'PRIMARY',
)
const selectedLevel = ref<BrandPaletteLevel>(
  props.modelValue.kind === 'PALETTE' ? props.modelValue.level : 500,
)
const customColor = ref(props.modelValue.kind === 'LITERAL' ? props.modelValue.value : '#6366f1')
const customSeed = ref(customColor.value)
const customLevel = ref<BrandPaletteLevel>(500)
const recommended = ref(false)

const paletteItems = computed<ThemePaletteSelectItem[]>(() => [
  {
    value: 'BASE',
    label: `当前中性色${props.theme.customBasePalette ? ' · 已微调' : ''}`,
    colors:
      props.theme.customBasePalette?.colors ??
      getThemePaletteColors(props.theme.basePalette, 'base'),
  },
  {
    value: 'PRIMARY',
    label: `当前品牌色${props.theme.customPrimaryPalette ? ' · 已微调' : ''}`,
    colors:
      props.theme.customPrimaryPalette?.colors ??
      getThemePaletteColors(props.theme.primaryPalette, 'primary'),
  },
  ...brandPrimaryPalettes.map((value) => ({
    value,
    label: value,
    colors: getThemePaletteColors(value, 'primary'),
  })),
])
const selectedColors = computed(
  () => paletteItems.value.find((item) => item.value === selectedPalette.value)?.colors ?? {},
)
const generatedColors = computed(() => generateThemePaletteColors(customSeed.value))
const nearest = computed(() => generateNearestPalette(customSeed.value, 'hslString'))
const triggerLabel = computed(() => {
  const value = props.modelValue
  if (value.kind === 'PALETTE') {
    const name =
      value.palette === 'BASE'
        ? '当前中性色'
        : value.palette === 'PRIMARY'
          ? '当前品牌色'
          : value.palette
    return `${name}.${value.level}`
  }
  return value.kind === 'LITERAL'
    ? value.value
    : value.value === 'white'
      ? '白色'
      : value.value === 'black'
        ? '黑色'
        : '透明'
})
const triggerColor = computed(() => {
  const value = props.modelValue
  if (value.kind === 'PALETTE')
    return paletteItems.value.find((item) => item.value === value.palette)?.colors[value.level]?.hsl
  return value.value
})

watch(
  () => props.modelValue,
  (value, previous) => {
    if (value.kind === 'PALETTE') {
      mode.value = 'palette'
      selectedPalette.value = value.palette
      selectedLevel.value = value.level
    } else if (value.kind === 'SIMPLE') {
      mode.value = 'simple'
    } else {
      mode.value = 'custom'
      customColor.value = value.value
      if (previous.kind !== 'LITERAL') customSeed.value = value.value
    }
  },
)

function changeMode(value: ColorMode): void {
  if (props.disabled) return
  mode.value = value
  if (value === 'palette') {
    emit('update:modelValue', {
      kind: 'PALETTE',
      palette: selectedPalette.value,
      level: selectedLevel.value,
    })
  } else if (value === 'custom') {
    const color =
      props.modelValue.kind === 'PALETTE'
        ? selectedColors.value[props.modelValue.level]?.hsl
        : props.modelValue.kind === 'SIMPLE'
          ? props.modelValue.value
          : props.modelValue.value
    const initial = color === 'transparent' ? '#6366f1' : (color ?? '#6366f1')
    customColor.value = initial
    customSeed.value = initial
    emit('update:modelValue', { kind: 'LITERAL', value: normalizeThemePaletteColor(initial).hsl })
  } else {
    emit('update:modelValue', { kind: 'SIMPLE', value: 'white' })
  }
}

function selectPalette(value: string): void {
  if (props.disabled) return
  const found = paletteItems.value.find((item) => item.value === value)
  if (found === undefined) return
  selectedPalette.value = found.value as PaletteKey
  emit('update:modelValue', {
    kind: 'PALETTE',
    palette: selectedPalette.value,
    level: selectedLevel.value,
  })
}

function selectLevel(level: BrandPaletteLevel): void {
  if (props.disabled) return
  selectedLevel.value = level
  emit('update:modelValue', { kind: 'PALETTE', palette: selectedPalette.value, level })
}

function updateCustomColor(value: string): void {
  if (props.disabled) return
  let normalized: string
  try {
    normalized = normalizeThemePaletteColor(value).hsl
  } catch {
    return
  }
  customColor.value = value
  customSeed.value = value
  customLevel.value = 500
  emit('update:modelValue', { kind: 'LITERAL', value: normalized })
}

function selectCustomLevel(level: BrandPaletteLevel): void {
  if (props.disabled) return
  customLevel.value = level
  if (recommended.value) {
    emit('update:modelValue', { kind: 'PALETTE', palette: nearest.value.paletteKey, level })
    return
  }
  const value = generatedColors.value[level].hsl
  customColor.value = value
  emit('update:modelValue', { kind: 'LITERAL', value })
}
</script>

<template>
  <details
    name="brand-semantic-colors"
    class="rounded-md border border-border bg-card"
    data-brand-color-picker
    :inert="disabled"
    :aria-disabled="disabled"
  >
    <summary
      class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-foreground"
    >
      <span
        class="size-4 shrink-0 rounded-full border border-border"
        :style="{ backgroundColor: triggerColor }"
      />
      <span class="min-w-0 flex-1 truncate">{{ triggerLabel }}</span>
      <span class="text-xs text-muted-foreground">调整</span>
    </summary>
    <div class="grid gap-2 border-t border-border p-2">
      <Segment
        :model-value="mode"
        :items="modeItems"
        size="xs"
        :disabled="disabled"
        @update:model-value="changeMode"
      />

      <template v-if="mode === 'palette'">
        <ThemePaletteSelect
          :model-value="selectedPalette"
          :items="paletteItems"
          :disabled="disabled"
          aria-label="选择语义色系"
          size="sm"
          @update:model-value="selectPalette"
        />
        <div class="flex flex-wrap gap-1.5" aria-label="选择色阶">
          <button
            v-for="level in brandPaletteLevels"
            :key="level"
            type="button"
            class="grid gap-0.5 rounded p-0.5 text-center text-[10px] focus-visible:outline-2 focus-visible:outline-primary"
            :class="selectedLevel === level ? 'ring-2 ring-primary' : 'hover:bg-muted'"
            :aria-label="`选择 ${level} 色阶`"
            :aria-pressed="selectedLevel === level"
            :disabled="disabled"
            @click="selectLevel(level)"
          >
            <span
              class="size-5 rounded-full border border-border"
              :style="{ backgroundColor: selectedColors[level]?.hsl }"
            />
            <span>{{ level }}</span>
          </button>
        </div>
      </template>

      <template v-else-if="mode === 'custom'">
        <ColorPicker
          :model-value="customColor"
          :show-alpha="false"
          :disabled="disabled"
          size="sm"
          @update:model-value="updateCustomColor"
        />
        <div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>推荐最近预设色</span>
          <Switch v-model="recommended" :disabled="disabled" aria-label="推荐最近预设色" />
        </div>
        <p class="m-0 text-[11px] text-muted-foreground">
          {{
            recommended ? `最近预设：${nearest.paletteKey}` : '点击色阶只选颜色，不重新生成色板。'
          }}
        </p>
        <div class="flex flex-wrap gap-1.5" aria-label="选择自定义颜色深浅">
          <button
            v-for="level in brandPaletteLevels"
            :key="level"
            type="button"
            class="grid gap-0.5 rounded p-0.5 text-center text-[10px] focus-visible:outline-2 focus-visible:outline-primary"
            :class="customLevel === level ? 'ring-2 ring-primary' : 'hover:bg-muted'"
            :aria-label="`选择自定义 ${level} 色阶`"
            :aria-pressed="customLevel === level"
            :disabled="disabled"
            @click="selectCustomLevel(level)"
          >
            <span
              class="size-5 rounded-full border border-border"
              :style="{
                backgroundColor: recommended ? nearest.palette[level] : generatedColors[level].hsl,
              }"
            />
            <span>{{ level }}</span>
          </button>
        </div>
      </template>

      <div v-else class="flex flex-wrap gap-2">
        <button
          v-for="value in ['white', 'black', 'transparent'] as const"
          :key="value"
          type="button"
          class="rounded border border-border px-2 py-1 text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
          :aria-pressed="modelValue.kind === 'SIMPLE' && modelValue.value === value"
          :disabled="disabled"
          @click="emit('update:modelValue', { kind: 'SIMPLE', value })"
        >
          {{ value === 'white' ? '白色' : value === 'black' ? '黑色' : '透明' }}
        </button>
      </div>
    </div>
  </details>
</template>
