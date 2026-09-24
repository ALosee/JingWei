<script setup lang="ts">
import { computed } from 'vue'

import SSelect from '../../components/select/select.vue'
import type { SelectOptionData } from '../../components/select/types'
import type { ThemePaletteColors } from './theme-palette'
import type { ThemePaletteSelectProps } from './types'

const props = withDefaults(defineProps<ThemePaletteSelectProps>(), {
  disabled: false,
  size: 'md',
  decorateLevels: () => [200, 400, 500, 700, 900],
})
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const selectItems = computed<SelectOptionData<string>[]>(() =>
  props.items.map(({ label, value }) => ({ label, value })),
)

function colorsOf(value: string): Partial<ThemePaletteColors> {
  return props.items.find((item) => item.value === value)?.colors ?? {}
}

function update(value: unknown): void {
  if (typeof value === 'string') emit('update:modelValue', value)
}
</script>

<template>
  <SSelect
    :model-value="modelValue"
    :items="selectItems"
    :disabled="disabled"
    :size="size"
    @update:model-value="update"
  >
    <template #trigger-leading>
      <span class="flex shrink-0 overflow-hidden rounded-sm border border-border">
        <span
          v-for="level in decorateLevels"
          :key="level"
          class="h-4 w-2.5"
          :style="{ backgroundColor: colorsOf(modelValue)[level]?.hsl }"
        />
      </span>
    </template>
    <template #item-leading="{ item }">
      <span class="flex shrink-0 overflow-hidden rounded-sm border border-border">
        <span
          v-for="level in decorateLevels"
          :key="level"
          class="h-4 w-2.5"
          :style="{ backgroundColor: colorsOf(item.value)[level]?.hsl }"
        />
      </span>
    </template>
  </SSelect>
</template>
