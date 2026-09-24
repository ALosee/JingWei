<script setup lang="ts">
import { computed, ref } from 'vue'

import { Button, Segment } from '@jingwei/ui'
import type { SegmentOptionData } from '@jingwei/ui'

import {
  type BrandSemanticTokenKey,
  type BrandThemeColor,
  type BrandVisualTheme,
} from '../../shared/index.js'
import BrandingSemanticColorPicker from './branding-semantic-color-picker.vue'

const props = defineProps<{ modelValue: BrandVisualTheme; disabled: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: BrandVisualTheme] }>()

type ThemeMode = 'light' | 'dark'
const mode = ref<ThemeMode>('light')
const modeItems: SegmentOptionData<ThemeMode>[] = [
  { value: 'light', label: '浅色模式' },
  { value: 'dark', label: '深色模式' },
]
const tokenGroups: {
  title: string
  description: string
  tokens: { key: BrandSemanticTokenKey; label: string }[]
}[] = [
  {
    title: '表面与文字',
    description: '页面、卡片、浮层以及对应的前景文字。',
    tokens: [
      { key: 'background', label: '页面背景' },
      { key: 'foreground', label: '页面前景' },
      { key: 'card', label: '卡片背景' },
      { key: 'cardForeground', label: '卡片前景' },
      { key: 'popover', label: '浮层背景' },
      { key: 'popoverForeground', label: '浮层前景' },
    ],
  },
  {
    title: '交互与边界',
    description: '品牌操作、次要区域、弱化区域、输入框和焦点状态。',
    tokens: [
      { key: 'primary', label: '主色' },
      { key: 'primaryForeground', label: '主色前景' },
      { key: 'secondary', label: '次要' },
      { key: 'secondaryForeground', label: '次要前景' },
      { key: 'muted', label: '弱化' },
      { key: 'mutedForeground', label: '弱化前景' },
      { key: 'accent', label: '强调' },
      { key: 'accentForeground', label: '强调前景' },
      { key: 'border', label: '边框' },
      { key: 'input', label: '输入框' },
      { key: 'ring', label: '焦点环' },
    ],
  },
  {
    title: '侧栏',
    description: '覆盖侧栏预设中的独立颜色角色。',
    tokens: [
      { key: 'sidebar', label: '侧栏背景' },
      { key: 'sidebarForeground', label: '侧栏前景' },
      { key: 'sidebarPrimary', label: '侧栏主色' },
      { key: 'sidebarPrimaryForeground', label: '侧栏主色前景' },
      { key: 'sidebarAccent', label: '侧栏强调' },
      { key: 'sidebarAccentForeground', label: '侧栏强调前景' },
      { key: 'sidebarBorder', label: '侧栏边框' },
      { key: 'sidebarRing', label: '侧栏焦点环' },
    ],
  },
  {
    title: '状态反馈',
    description: '错误、成功、警告、信息和中性状态。',
    tokens: [
      { key: 'destructive', label: '错误' },
      { key: 'destructiveForeground', label: '错误前景' },
      { key: 'success', label: '成功' },
      { key: 'successForeground', label: '成功前景' },
      { key: 'warning', label: '警告' },
      { key: 'warningForeground', label: '警告前景' },
      { key: 'info', label: '信息' },
      { key: 'infoForeground', label: '信息前景' },
      { key: 'carbon', label: '中性状态' },
      { key: 'carbonForeground', label: '中性状态前景' },
    ],
  },
  {
    title: '数据图表',
    description: '五组有序数据色，可在图表中稳定复用。',
    tokens: [
      { key: 'chart1', label: '图表 1' },
      { key: 'chart2', label: '图表 2' },
      { key: 'chart3', label: '图表 3' },
      { key: 'chart4', label: '图表 4' },
      { key: 'chart5', label: '图表 5' },
    ],
  },
]
const activeOverrides = computed(() => props.modelValue.overrides[mode.value])

function defaultColor(key: BrandSemanticTokenKey): BrandThemeColor {
  if (key.endsWith('Foreground'))
    return { kind: 'SIMPLE', value: mode.value === 'light' ? 'white' : 'black' }
  if (key === 'primary' || key === 'ring' || key === 'sidebarPrimary' || key === 'sidebarRing')
    return { kind: 'PALETTE', palette: 'PRIMARY', level: mode.value === 'light' ? 500 : 400 }
  if (key === 'destructive') return { kind: 'PALETTE', palette: 'red', level: 500 }
  if (key === 'success') return { kind: 'PALETTE', palette: 'green', level: 500 }
  if (key === 'warning') return { kind: 'PALETTE', palette: 'amber', level: 500 }
  if (key === 'info') return { kind: 'PALETTE', palette: 'blue', level: 500 }
  if (key.startsWith('chart')) return { kind: 'PALETTE', palette: 'PRIMARY', level: 500 }
  if (key === 'foreground' || key === 'sidebarForeground')
    return { kind: 'PALETTE', palette: 'BASE', level: mode.value === 'light' ? 950 : 50 }
  return { kind: 'PALETTE', palette: 'BASE', level: mode.value === 'light' ? 50 : 900 }
}

function setToken(key: BrandSemanticTokenKey, value: BrandThemeColor | undefined): void {
  if (props.disabled) return
  const nextMode =
    value === undefined
      ? Object.fromEntries(Object.entries(activeOverrides.value).filter(([entry]) => entry !== key))
      : { ...activeOverrides.value, [key]: value }
  emit('update:modelValue', {
    ...props.modelValue,
    overrides: { ...props.modelValue.overrides, [mode.value]: nextMode },
  })
}
</script>

<template>
  <section class="grid gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="m-0 text-sm text-foreground font-650">语义颜色覆盖</h3>
        <p class="mb-0 mt-1 text-xs text-muted-foreground">
          未覆盖的角色继续由色阶和方案自动推导；只保存租户确实需要差异化的部分。
        </p>
      </div>
      <Segment v-model="mode" :items="modeItems" size="sm" />
    </div>

    <div class="grid gap-4">
      <section
        v-for="group in tokenGroups"
        :key="group.title"
        class="overflow-hidden rounded-lg border border-border"
      >
        <details class="group">
          <summary
            class="flex cursor-pointer items-center justify-between gap-3 bg-muted/35 px-4 py-3"
          >
            <span class="grid gap-0.5">
              <strong class="text-sm text-foreground font-600">{{ group.title }}</strong>
              <span class="text-xs text-muted-foreground">{{ group.description }}</span>
            </span>
            <span class="shrink-0 text-xs text-muted-foreground">
              已覆盖 {{ group.tokens.filter((token) => activeOverrides[token.key]).length }}/{{
                group.tokens.length
              }}
            </span>
          </summary>
          <div class="divide-y divide-border border-t border-border">
            <div
              v-for="token in group.tokens"
              :key="token.key"
              class="grid items-center gap-2 px-4 py-2.5 sm:grid-cols-[minmax(8rem,1fr)_minmax(12rem,18rem)_auto]"
            >
              <div class="min-w-0">
                <div class="text-sm text-foreground">{{ token.label }}</div>
                <code class="text-[11px] text-muted-foreground">{{ token.key }}</code>
              </div>
              <BrandingSemanticColorPicker
                v-if="activeOverrides[token.key]"
                :model-value="activeOverrides[token.key]!"
                :theme="modelValue"
                :disabled="disabled"
                class="w-full"
                @update:model-value="setToken(token.key, $event)"
              />
              <span v-else class="text-xs text-muted-foreground">跟随系统推导</span>
              <Button
                v-if="activeOverrides[token.key]"
                size="sm"
                variant="ghost"
                :disabled="disabled"
                @click="setToken(token.key, undefined)"
              >
                重置
              </Button>
              <Button
                v-else
                size="sm"
                variant="outline"
                :disabled="disabled"
                @click="setToken(token.key, defaultColor(token.key))"
              >
                设置
              </Button>
            </div>
          </div>
        </details>
      </section>
    </div>
  </section>
</template>
