<script setup lang="ts">
import { colord } from '@soybeanjs/colord'
import { computed, ref, watch } from 'vue'

import {
  Button,
  ColorPicker,
  Dialog,
  Icon,
  Input,
  Segment,
  ThemePaletteSelect,
  getThemePaletteColors,
  normalizeThemePaletteColor,
  themePaletteLevels,
} from '@jingwei/ui'
import type { SegmentOptionData, ThemePaletteSelectItem } from '@jingwei/ui'

import { inspectBrandThemePair } from '../../shared/brand-theme-validation.js'
import {
  brandBasePalettes,
  brandPrimaryPalettes,
  type BrandPaletteLevel,
  type BrandVisualTheme,
} from '../../shared/index.js'
import {
  cloneCurrentBrandPalette,
  regenerateBrandPalette,
  selectBrandThemeLevel,
  updateBrandPaletteLevel,
} from '../brand-theme-editor-state.js'

const props = defineProps<{
  modelValue: BrandVisualTheme
  target: 'base' | 'primary'
  mode: 'light' | 'dark'
  disabled: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: BrandVisualTheme]
  'update:mode': [value: 'light' | 'dark']
}>()

const neutralLabels: Record<(typeof brandBasePalettes)[number], string> = {
  slate: '石板灰',
  mist: '雾灰',
  gray: '灰',
  zinc: '锌灰',
  neutral: '中性灰',
  stone: '石色',
  taupe: '灰褐',
  olive: '橄榄灰',
  mauve: '紫灰',
}
const chromaticLabels: Partial<Record<(typeof brandPrimaryPalettes)[number], string>> = {
  red: '红色',
  orange: '橙色',
  amber: '琥珀',
  yellow: '黄色',
  lime: '青柠',
  green: '绿色',
  emerald: '祖母绿',
  teal: '青绿',
  cyan: '青色',
  sky: '天蓝',
  blue: '蓝色',
  indigo: '靛蓝',
  violet: '紫罗兰',
  purple: '紫色',
  fuchsia: '品红',
  pink: '粉色',
  rose: '玫红',
}

const neutralRoles: SegmentOptionData<'background' | 'card' | 'popover'>[] = [
  { value: 'background', label: '页面背景' },
  { value: 'card', label: '卡片' },
  { value: 'popover', label: '浮层' },
]
const neutralRole = ref<'background' | 'card' | 'popover'>('background')
const editingRamp = ref(false)
const editingLevel = ref<BrandPaletteLevel>(500)
const pickerOpen = ref(false)
const regenerationSeed = ref('')
const isBase = computed(() => props.target === 'base')
const selectedKey = computed(() =>
  isBase.value ? props.modelValue.basePalette : props.modelValue.primaryPalette,
)
const custom = computed(() =>
  isBase.value ? props.modelValue.customBasePalette : props.modelValue.customPrimaryPalette,
)
const selectedToken = computed<'background' | 'card' | 'popover' | 'primary'>(() =>
  isBase.value ? neutralRole.value : 'primary',
)
const activeColor = computed(() => props.modelValue.overrides[props.mode][selectedToken.value])
const darkContrast = computed(() =>
  inspectBrandThemePair(props.modelValue, 'dark', selectedToken.value),
)
const darkHasOwnColor = computed(
  () => props.modelValue.overrides.dark[selectedToken.value] !== undefined,
)
const darkSurfaceHex = computed(() =>
  darkContrast.value === null ? '' : colord(darkContrast.value.surfaceColor).toHex(),
)
const darkContrastLabel = computed(() =>
  darkContrast.value === null ? '' : (Math.floor(darkContrast.value.ratio * 100) / 100).toFixed(2),
)
const colors = computed(
  () => custom.value?.colors ?? cloneCurrentBrandPalette(props.modelValue, props.target).colors,
)
const items = computed<ThemePaletteSelectItem[]>(() =>
  (isBase.value ? brandBasePalettes : brandPrimaryPalettes).map((value) => ({
    value,
    label:
      (isBase.value
        ? neutralLabels[value as keyof typeof neutralLabels]
        : (chromaticLabels[value] ?? value)) +
      (selectedKey.value === value && custom.value !== null ? ' · 已微调' : ''),
    colors:
      selectedKey.value === value && custom.value !== null
        ? custom.value.colors
        : getThemePaletteColors(value, props.target),
  })),
)

watch(
  () => custom.value?.seedColor ?? colors.value[500].hsl,
  (seedColor) => {
    regenerationSeed.value = seedColor
  },
  { immediate: true },
)
watch(editingRamp, (open) => {
  if (!open) pickerOpen.value = false
})

function updateCustom(value: NonNullable<typeof custom.value>): void {
  if (props.disabled) return
  emit('update:modelValue', {
    ...props.modelValue,
    ...(isBase.value ? { customBasePalette: value } : { customPrimaryPalette: value }),
  })
}

function selectPreset(value: string): void {
  if (props.disabled || value === selectedKey.value) return
  if (custom.value !== null && !window.confirm('切换预设色会替换当前微调色阶，确定继续？')) return
  if (isBase.value && brandBasePalettes.some((candidate) => candidate === value))
    emit('update:modelValue', {
      ...props.modelValue,
      basePalette: value as (typeof brandBasePalettes)[number],
      customBasePalette: null,
    })
  if (!isBase.value && brandPrimaryPalettes.some((candidate) => candidate === value))
    emit('update:modelValue', {
      ...props.modelValue,
      primaryPalette: value as (typeof brandPrimaryPalettes)[number],
      customPrimaryPalette: null,
    })
  editingRamp.value = false
  regenerationSeed.value = ''
}

function startTuning(): void {
  if (props.disabled) return
  pickerOpen.value = false
  const active = activeColor.value
  editingLevel.value =
    active?.kind === 'PALETTE' && active.palette === (isBase.value ? 'BASE' : 'PRIMARY')
      ? active.level
      : 500
  editingRamp.value = true
}

function selectEditingLevel(level: BrandPaletteLevel): void {
  if (props.disabled) return
  editingLevel.value = level
  pickerOpen.value = true
}

function resetRamp(): void {
  if (props.disabled || custom.value === null) return
  if (!window.confirm('恢复当前预设的全部色阶？逐级微调将被移除。')) return
  emit('update:modelValue', {
    ...props.modelValue,
    ...(isBase.value ? { customBasePalette: null } : { customPrimaryPalette: null }),
  })
  regenerationSeed.value = cloneCurrentBrandPalette(props.modelValue, props.target).seedColor
}

function applyLevel(level: (typeof themePaletteLevels)[number]): void {
  if (props.disabled) return
  emit(
    'update:modelValue',
    selectBrandThemeLevel(
      props.modelValue,
      props.mode,
      selectedToken.value,
      isBase.value ? 'BASE' : 'PRIMARY',
      level,
    ),
  )
}

function resetRole(): void {
  if (props.disabled) return
  const next = Object.fromEntries(
    Object.entries(props.modelValue.overrides[props.mode]).filter(
      ([token]) => token !== selectedToken.value,
    ),
  )
  emit('update:modelValue', {
    ...props.modelValue,
    overrides: { ...props.modelValue.overrides, [props.mode]: next },
  })
}

function updateLevel(level: (typeof themePaletteLevels)[number], value: unknown): void {
  if (props.disabled || typeof value !== 'string') return
  try {
    updateCustom(
      updateBrandPaletteLevel(
        custom.value ?? cloneCurrentBrandPalette(props.modelValue, props.target),
        level,
        value,
      ),
    )
  } catch {
    // The color picker can emit an incomplete typed value while editing.
  }
}

function regenerate(): void {
  if (props.disabled || !regenerationSeed.value) return
  try {
    normalizeThemePaletteColor(regenerationSeed.value)
  } catch {
    return
  }
  if (!window.confirm('根据基准色重建全部 11 级色阶？现有逐级微调会被覆盖。')) return
  updateCustom(
    regenerateBrandPalette(
      custom.value ?? cloneCurrentBrandPalette(props.modelValue, props.target),
      regenerationSeed.value,
    ),
  )
}

function renameRamp(value: unknown): void {
  if (props.disabled || typeof value !== 'string') return
  updateCustom({
    ...(custom.value ?? cloneCurrentBrandPalette(props.modelValue, props.target)),
    name: value,
  })
}

function displayColor(level: BrandPaletteLevel): string {
  return colord(colors.value[level].hsl).toHex()
}
</script>

<template>
  <section
    :data-brand-palette-card="target"
    class="grid gap-4 rounded-xl border p-4 sm:p-5"
    :class="isBase ? 'border-border bg-muted/15' : 'border-primary/30 bg-primary/3'"
  >
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-lg"
          :class="isBase ? 'bg-muted text-muted-foreground' : 'bg-primary/12 text-primary'"
        >
          <Icon :icon="isBase ? 'lucide:layers-3' : 'lucide:palette'" class="size-5" />
        </span>
        <div>
          <h3 class="m-0 text-sm text-foreground font-650">
            {{ isBase ? '基础中性色' : '品牌主色' }}
          </h3>
          <p class="mb-0 mt-1 text-xs text-muted-foreground">
            {{ isBase ? '控制页面、卡片与浮层的中性表面。' : '控制按钮等主要品牌操作色。' }}
          </p>
        </div>
      </div>
      <span v-if="custom" class="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
        已微调色阶
      </span>
    </header>

    <div class="flex flex-wrap items-center gap-2">
      <ThemePaletteSelect
        :model-value="selectedKey"
        :items="items"
        :disabled="disabled"
        :aria-label="isBase ? '选择基础中性色系' : '选择品牌主色色系'"
        class="min-w-48 flex-1"
        @update:model-value="selectPreset"
      />
      <Button data-ramp-edit size="sm" variant="outline" :disabled="disabled" @click="startTuning">
        逐级编辑色阶
      </Button>
    </div>

    <div v-if="isBase" class="grid gap-2">
      <span class="text-xs text-muted-foreground">选择要调整的表面</span>
      <Segment v-model="neutralRole" :items="neutralRoles" size="sm" />
    </div>
    <div class="grid gap-2">
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {{ mode === 'light' ? '浅色' : '深色' }} ·
          {{ isBase ? neutralRoles.find((item) => item.value === neutralRole)?.label : '主色' }}
          · {{ activeColor ? '已单独设置' : '自动推导' }}
        </span>
        <Button
          v-if="activeColor"
          size="xs"
          variant="ghost"
          :disabled="disabled"
          @click="resetRole"
        >
          恢复自动
        </Button>
      </div>
      <div class="grid grid-cols-6 gap-2 sm:grid-cols-11">
        <button
          v-for="level in themePaletteLevels"
          :key="level"
          type="button"
          class="grid min-w-0 gap-1 rounded-md p-1 text-center text-[11px] text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
          :class="
            activeColor?.kind === 'PALETTE' &&
            activeColor.palette === (isBase ? 'BASE' : 'PRIMARY') &&
            activeColor.level === level
              ? 'bg-primary/10 ring-2 ring-primary'
              : 'hover:bg-muted'
          "
          :aria-label="`将${isBase ? neutralRoles.find((item) => item.value === neutralRole)?.label : '主色'}设为 ${level} 色阶`"
          :aria-pressed="
            activeColor?.kind === 'PALETTE' &&
            activeColor.palette === (isBase ? 'BASE' : 'PRIMARY') &&
            activeColor.level === level
          "
          :disabled="disabled"
          @click="applyLevel(level)"
        >
          <span
            class="mx-auto size-7 rounded-full border border-border shadow-sm"
            :style="{ backgroundColor: colors[level]?.hsl }"
          />
          <span>{{ level }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="mode === 'light' && activeColor && darkContrast"
      data-dark-result
      class="grid gap-2 rounded-lg border px-3 py-3 text-xs"
      :class="
        darkContrast.ratio < 3 ? 'border-warning/40 bg-warning/6' : 'border-border bg-muted/20'
      "
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="grid gap-0.5">
          <strong class="text-foreground font-600">深色实际效果</strong>
          <span class="text-muted-foreground">
            {{ darkHasOwnColor ? '深色已单独设置。' : '浅色覆盖会参与深色自动推导。' }}
          </span>
        </div>
        <Button data-switch-dark size="xs" variant="outline" @click="emit('update:mode', 'dark')">
          {{ disabled ? '查看深色' : '切换深色调整' }}
        </Button>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-muted-foreground">
        <span
          class="grid size-8 shrink-0 place-items-center rounded-md border border-border text-sm font-600"
          :style="{
            backgroundColor: darkContrast.surfaceColor,
            color: darkContrast.foregroundColor,
          }"
          aria-hidden="true"
          >Aa</span
        >
        <span>实际颜色 {{ darkSurfaceHex }} · 与前景对比度 {{ darkContrastLabel }}:1</span>
        <span v-if="darkContrast.ratio < 3" class="text-warning font-600">
          低于 3:1，发布前需调整
        </span>
      </div>
    </div>

    <Dialog
      v-model:open="editingRamp"
      :title="isBase ? '微调基础中性色阶' : '微调品牌主色色阶'"
      description="点击任意色块即可调整该级颜色；打开编辑窗不会改变草稿。"
      :show-fullscreen="false"
      :show-confirm="false"
      class="!min-w-0 !w-[calc(100vw-2rem)] !max-w-[52rem] max-h-[90vh]"
    >
      <div class="grid gap-5 text-sm">
        <label class="grid min-w-0 gap-1.5 text-muted-foreground">
          <span>色板名称</span>
          <Input
            :model-value="custom?.name ?? (isBase ? '中性色阶微调' : '品牌色阶微调')"
            :maxlength="40"
            :disabled="disabled"
            @update:model-value="renameRamp"
          />
        </label>

        <div class="grid gap-2">
          <span class="text-muted-foreground">点击色块调整对应色阶</span>
          <div class="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-11">
            <button
              v-for="level in themePaletteLevels"
              :key="level"
              type="button"
              class="grid min-w-0 justify-items-center gap-1 rounded-lg border px-1 py-2 text-xs focus-visible:outline-2 focus-visible:outline-primary"
              :class="
                editingLevel === level
                  ? 'border-primary bg-primary/8 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              "
              :aria-label="`编辑 ${level} 色阶`"
              :aria-pressed="editingLevel === level"
              @click="selectEditingLevel(level)"
            >
              <span
                class="size-8 rounded-full border border-border shadow-sm"
                :style="{ backgroundColor: colors[level].hsl }"
              />
              <span>{{ level }}</span>
            </button>
          </div>
        </div>

        <div
          class="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/20 p-4"
        >
          <span
            class="size-14 shrink-0 rounded-lg border border-border shadow-sm"
            :style="{ backgroundColor: colors[editingLevel].hsl }"
          />
          <div class="min-w-0 flex-1">
            <p class="m-0 font-600 text-foreground">{{ editingLevel }} 色阶</p>
            <p class="mb-0 mt-1 font-mono text-xs text-muted-foreground">
              {{ displayColor(editingLevel) }}
            </p>
          </div>
          <div data-ramp-color-picker class="min-w-0 w-52 max-w-full">
            <p class="m-0 mb-1 text-xs text-muted-foreground">调整当前色阶颜色</p>
            <ColorPicker
              :key="editingLevel"
              v-model:open="pickerOpen"
              :model-value="colors[editingLevel].hsl"
              default-format="hex"
              :show-alpha="false"
              :disabled="disabled"
              :positioner-props="{ style: { zIndex: 60 } }"
              :popup-props="{
                class:
                  'rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-xl',
              }"
              class="min-w-0 w-full"
              @update:model-value="updateLevel(editingLevel, $event)"
            />
          </div>
        </div>
        <p class="m-0 text-xs text-muted-foreground">
          当前级别之外的颜色不会改变；发布前会检查色阶的由浅到深顺序。
        </p>

        <details class="rounded-lg border border-border">
          <summary class="cursor-pointer px-4 py-3 text-sm text-muted-foreground">
            高级：重新生成整套色阶
          </summary>
          <div class="grid gap-3 border-t border-border p-4">
            <p class="m-0 text-xs text-muted-foreground">
              仅在想整体换色时使用。先选基准色，再确认重建；已有逐级微调会被覆盖。
            </p>
            <div class="flex flex-wrap items-end gap-3">
              <label class="grid min-w-0 w-52 max-w-full gap-1.5 text-xs text-muted-foreground">
                重建基准色
                <ColorPicker
                  :model-value="regenerationSeed"
                  default-format="hex"
                  :show-alpha="false"
                  :disabled="disabled"
                  :positioner-props="{ style: { zIndex: 60 } }"
                  :popup-props="{
                    class:
                      'rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-xl',
                  }"
                  class="min-w-0 w-full"
                  @update:model-value="regenerationSeed = $event"
                />
              </label>
              <Button size="sm" variant="outline" :disabled="disabled" @click="regenerate">
                重建全部 11 级
              </Button>
            </div>
          </div>
        </details>

        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <Button v-if="custom" size="sm" variant="ghost" :disabled="disabled" @click="resetRamp">
            恢复当前预设
          </Button>
          <span v-else />
          <Button size="sm" @click="editingRamp = false">完成</Button>
        </div>
      </div>
    </Dialog>
  </section>
</template>
