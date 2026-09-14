<script setup lang="ts">
import { THEME_RADIUS, themeRadiusKeys, themeSizeKeys } from '@soybeanjs/theme'
import type {
  BaseColorKey,
  ChartSchemeKey,
  ColorKey,
  ColorValue,
  DarkLevelOffset,
  FeedbackSchemeKey,
  LightLevelOffset,
  PrimaryColorKey,
  SidebarSchemeKey,
  ThemeRadius,
  ThemeSize,
} from '@soybeanjs/theme'
import { computed, ref, watch } from 'vue'

import SButton from '../../components/button/button.vue'
import { useTheme } from '../../components/config-provider/use-theme'
import SIcon from '../../components/icon/icon.vue'
import SSegment from '../../components/segment/segment.vue'
import type { SegmentOptionData } from '../../components/segment/types'
import SSelect from '../../components/select/select.vue'
import type { SelectOptionData } from '../../components/select/types'
import SSlider from '../../components/slider/slider.vue'
import { useThemeSettings } from '../../theme/use-theme-settings'
import { useThemeVariants } from '../../theme/use-theme-variants'
import BasePaletteSelect from './base-palette-select.vue'
import ChartSchemaSelect from './chart-schema-select.vue'
import FeedbackSchemaSelect from './feedback-schema-select.vue'
import SPalettePicker from './palette-picker.vue'
import PrimaryPaletteSelect from './primary-palette-select.vue'
import SectionItem from './section-item.vue'
import SidebarSchemaSelect from './sidebar-schema-select.vue'
import ThemeModeSelect from './theme-mode-select.vue'
import type { ThemeCustomizerProps, ThemeCustomizerSection } from './types'
import { useThemeCustomizerLocale } from './use-locale'

defineOptions({
  name: 'SThemeCustomizer',
})

const props = withDefaults(defineProps<ThemeCustomizerProps>(), {
  sections: () => ['mode', 'palette', 'radius', 'size', 'scheme', 'advanced'],
  size: 'md',
  persist: true,
  showActions: true,
})

// —— 文案国际化：跟随 ConfigProvider.locale，切换语言即时刷新 ——
const { resolveLabel: resolveBaseLabel, resolveOption } = useThemeCustomizerLocale()

const resolveLabel = (key: string): string =>
  props.labelResolver ? props.labelResolver(key) : resolveBaseLabel(key)

// —— 运行时主题上下文 ——
const themeContext = useTheme()

if (!themeContext) {
  throw new Error('ThemeCustomizer must be rendered inside ConfigProvider')
}

const theme = themeContext

// —— 状态核心：初始化自当前主题，改动即时 commit 到运行时 ——
const settings = useThemeSettings({
  persist: props.persist,
  initial: {
    ...theme.theme.value,
    mode: theme.mode.value,
  },
  apply: (state) => {
    theme.setThemeState(state)
  },
})

// —— 基础 token 绑定 ——
// mode 偏好由 <ThemeModeSelect> 直接绑定主题上下文，此处无需重复状态。
const baseValue = computed<BaseColorKey>({
  get: () => settings.state.value.base ?? 'zinc',
  set: (value) => settings.setState({ base: value }),
})

const primaryValue = computed<PrimaryColorKey>({
  get: () => settings.state.value.primary ?? 'indigo',
  set: (value) => settings.setState({ primary: value }),
})

const radiusValue = computed<ThemeRadius>({
  get: () => (settings.state.value.radius ?? 'md') as ThemeRadius,
  set: (value) => settings.setState({ radius: value }),
})
const radiusIndex = computed(() => {
  const matched = themeRadiusKeys.indexOf(radiusValue.value)
  return [matched >= 0 ? matched : themeRadiusKeys.indexOf('md')]
})
const radiusFromIndex = computed(() => {
  const key = themeRadiusKeys[radiusIndex.value[0] ?? 3]
  return key ?? 'md'
})
const radiusLabel = computed(() => THEME_RADIUS[radiusFromIndex.value])
const setRadiusValue = (values: number[]) => {
  const index = values[0]
  radiusValue.value = themeRadiusKeys[index ?? 3] ?? 'md'
}

const sizeValue = computed<ThemeSize>({
  get: () => (settings.state.value.size ?? 'md') as ThemeSize,
  set: (value) => settings.setState({ size: value }),
})

const feedbackValue = computed<FeedbackSchemeKey>({
  get: () => settings.state.value.feedback ?? 'classic',
  set: (value) => settings.setState({ feedback: value }),
})

const chartValue = computed<ChartSchemeKey>({
  get: () => settings.state.value.chart ?? 'vivid',
  set: (value) => settings.setState({ chart: value }),
})

const sidebarValue = computed<SidebarSchemeKey>({
  get: () => settings.state.value.sidebar ?? 'derived',
  set: (value) => settings.setState({ sidebar: value }),
})

const lightLevelValue = computed<LightLevelOffset>({
  get: () => settings.state.value.lightLevel ?? 0,
  set: (value) => settings.setState({ lightLevel: value }),
})

const darkLevelValue = computed<DarkLevelOffset>({
  get: () => settings.state.value.darkLevel ?? 0,
  set: (value) => settings.setState({ darkLevel: value }),
})

const borderOpacityValue = computed<number>({
  get: () => settings.state.value.borderOpacity ?? 1,
  set: (value) => settings.setState({ borderOpacity: value }),
})

const sizeOptions = computed<SelectOptionData<ThemeSize>[]>(() =>
  themeSizeKeys.map((key) => ({
    label: resolveOption('size', key),
    value: key,
  })),
)

// —— 编辑分片：level（Base 表面层级）与 custom（variant 分组）各自独立选择 light/dark ——
const levelMode = ref<'light' | 'dark'>('light')
const customMode = ref<'light' | 'dark'>('light')

const variantModeOptions = computed<SegmentOptionData<'light' | 'dark'>[]>(() => [
  { label: resolveOption('mode', 'light'), value: 'light' },
  { label: resolveOption('mode', 'dark'), value: 'dark' },
])

/** Base 表面层级分片：语义为 Lightness / Darkness 偏移，非主题亮/暗模式。 */
const levelModeOptions = computed<SegmentOptionData<'light' | 'dark'>[]>(() => [
  { label: resolveOption('level', 'lightness'), value: 'light' },
  { label: resolveOption('level', 'darkness'), value: 'dark' },
])

const variants = useThemeVariants({ settings, mode: customMode })

/** 写入某个 variant token 的 override（配合 `final` 值显示，反映当前派生结果） */
const setVariant = (key: ColorKey, value: string): void => {
  settings.setOverride(customMode.value, key, value as ColorValue)
}

// —— base 表面层级：lightLevel/darkLevel 由 Base 区域独立的 levelMode 分片决定 ——
// 标签与滑块范围随分片切换：light → Lightness(0-2)，dark → Darkness(0-3)。
const levelValue = computed<number>(() =>
  levelMode.value === 'light' ? lightLevelValue.value : darkLevelValue.value,
)
const levelMax = computed(() => (levelMode.value === 'light' ? 2 : 3))
const levelIndex = computed(() => [levelValue.value])
const setLevelValue = (values: number[]) => {
  const index = values[0] as LightLevelOffset
  if (levelMode.value === 'light') {
    lightLevelValue.value = index
  } else {
    darkLevelValue.value = index
  }
}

// —— 高级分区：默认折叠，避免与外层「主题/布局」Tabs 叠成双层导航 ——
const advancedOpen = ref(false)

const sectionVisible = (section: ThemeCustomizerSection): boolean =>
  props.sections.includes(section)

const hasAdvanced = computed(() => sectionVisible('advanced'))
const showLevels = computed(() => sectionVisible('advanced') && sectionVisible('palette'))
const showBorderOpacity = computed(() => sectionVisible('advanced'))
const showCustomTokens = computed(() => sectionVisible('advanced'))

watch(settings.state, () => settings.commit())

// —— mode 偏好由 <ThemeModeSelect> 直接绑定主题上下文（theme.mode），settings.state.mode
//    仅在初始化时快照。若不随 theme.mode 同步，则任何配置改动（如切换 base）触发 commit
//    时会把过期的 settings.state.mode（light）写回 theme，导致 mode 被重置 ——
watch(
  () => theme.mode.value,
  (value) => {
    settings.setState({ mode: value })
  },
)

function resetTheme(): void {
  settings.reset()
  settings.commit()
  theme.setMode('light')
}
</script>

<template>
  <div class="min-w-80 max-h-[70vh] flex flex-col gap-1">
    <!-- 常规主题：单列滚动，不再嵌套「主题 / 自定义」Tabs -->
    <div class="grow space-y-4 overflow-y-auto p-1">
      <SectionItem v-if="sectionVisible('mode')" :title="resolveLabel('mode')">
        <ThemeModeSelect class="w-35" />
      </SectionItem>

      <SectionItem
        v-if="sectionVisible('palette')"
        :title="resolveLabel('palette')"
        orientation="vertical"
      >
        <SectionItem :label="resolveLabel('base')">
          <BasePaletteSelect v-model="baseValue" class="w-50" />
        </SectionItem>
        <SectionItem :label="resolveLabel('primary')">
          <PrimaryPaletteSelect v-model="primaryValue" class="w-50" />
        </SectionItem>
      </SectionItem>

      <SectionItem
        v-if="sectionVisible('scheme')"
        :title="resolveLabel('scheme')"
        orientation="vertical"
      >
        <SectionItem :label="resolveLabel('feedback')">
          <FeedbackSchemaSelect v-model="feedbackValue" class="w-50" />
        </SectionItem>
        <SectionItem :label="resolveLabel('chart')">
          <ChartSchemaSelect v-model="chartValue" class="w-50" />
        </SectionItem>
        <SectionItem :label="resolveLabel('sidebar')">
          <SidebarSchemaSelect v-model="sidebarValue" class="w-50" />
        </SectionItem>
      </SectionItem>

      <SectionItem v-if="sectionVisible('size')" :title="resolveLabel('size')">
        <SSelect v-model="sizeValue" :items="sizeOptions" class="w-50" />
      </SectionItem>

      <SectionItem v-if="sectionVisible('radius')" :title="resolveLabel('radius')">
        <div class="w-2/3 flex items-center gap-3">
          <SSlider
            :model-value="radiusIndex"
            :min="0"
            :max="themeRadiusKeys.length - 1"
            :step="1"
            class="w-full"
            @update:model-value="setRadiusValue"
          />
          <span class="w-15 shrink-0 text-right text-xs text-muted-foreground">{{
            radiusLabel
          }}</span>
        </div>
      </SectionItem>

      <!-- 高级：默认折叠，避免常见项被 Custom 淹没 -->
      <section v-if="hasAdvanced" class="border-t border-border pt-3">
        <button
          type="button"
          class="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left outline-none hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-primary/30"
          :aria-expanded="advancedOpen"
          aria-controls="theme-customizer-advanced"
          @click="advancedOpen = !advancedOpen"
        >
          <span class="text-xs font-medium text-foreground">{{ resolveLabel('advanced') }}</span>
          <SIcon
            :icon="advancedOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'"
            class="size-4 text-muted-foreground"
          />
        </button>

        <div v-if="advancedOpen" id="theme-customizer-advanced" class="space-y-4 pt-2">
          <SectionItem v-if="showLevels">
            <template #left>
              <SSegment v-model="levelMode" :items="levelModeOptions" size="sm" class="shrink-0" />
            </template>
            <div class="w-3/5 flex items-center gap-3">
              <SSlider
                :model-value="levelIndex"
                :min="0"
                :max="levelMax"
                :step="1"
                class="w-full"
                @update:model-value="setLevelValue"
              />
              <span class="w-6 shrink-0 text-right text-xs text-muted-foreground">{{
                levelValue
              }}</span>
            </div>
          </SectionItem>

          <SectionItem v-if="showBorderOpacity" :label="resolveLabel('borderOpacity')">
            <div class="w-2/3 flex items-center gap-3">
              <SSlider
                :model-value="[borderOpacityValue * 100]"
                :min="0"
                :max="100"
                :step="5"
                class="w-full"
                @update:model-value="(value) => (borderOpacityValue = (value[0] ?? 100) / 100)"
              />
              <span class="w-10 shrink-0 text-right text-xs text-muted-foreground">
                {{ Math.round(borderOpacityValue * 100) }}%
              </span>
            </div>
          </SectionItem>

          <template v-if="showCustomTokens">
            <div class="flex-y-center justify-between border-t border-border pt-3">
              <span class="text-xs font-medium text-foreground">{{ resolveLabel('cssVars') }}</span>
              <SSegment v-model="customMode" :items="variantModeOptions" size="sm" />
            </div>

            <section v-for="group in variants.groups" :key="group.key" class="space-y-2">
              <h4 class="text-xs font-medium text-foreground">{{ resolveLabel(group.i18n) }}</h4>
              <div
                v-for="meta in group.tokens"
                :key="meta.key"
                class="flex-y-center justify-between gap-3"
              >
                <span class="text-xs text-foreground">{{ resolveLabel(meta.i18n) }}</span>
                <SPalettePicker
                  :size="size"
                  :model-value="variants.final.value[meta.key] ?? 'transparent'"
                  class="w-50"
                  @update:model-value="(value) => setVariant(meta.key, value)"
                />
              </div>
            </section>
          </template>
        </div>
      </section>
    </div>

    <section v-if="showActions" class="shrink-0 border-t border-border pt-3">
      <SButton
        :size="size"
        color="destructive"
        variant="outline"
        class="w-full"
        @click="resetTheme"
      >
        {{ resolveLabel('reset') }}
      </SButton>
    </section>
  </div>
</template>
