<script setup lang="ts">
import { computed, toRef } from 'vue'

import { Select } from '@jingwei/ui'
import type { SelectSingleOptionData } from '@jingwei/ui'

import { useDictionaryOptions } from './use-dictionary-options.js'

const props = withDefaults(
  defineProps<{
    dictionaryCode: string
    modelValue: string
    disabled?: boolean
    placeholder?: string
    includeDisabled?: boolean
  }>(),
  {
    disabled: false,
    placeholder: '请选择',
    includeDisabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { options, loading, error, reload } = useDictionaryOptions(toRef(props, 'dictionaryCode'), {
  includeDisabled: props.includeDisabled,
})

const selectItems = computed<SelectSingleOptionData<string>[]>(() =>
  options.value.map((option) => ({ value: option.value, label: option.label })),
)

function onUpdate(value: unknown) {
  if (typeof value === 'string') emit('update:modelValue', value)
}
</script>

<template>
  <div class="grid gap-1">
    <Select
      :model-value="modelValue"
      :items="selectItems"
      :disabled="disabled || loading"
      :placeholder="placeholder"
      @update:model-value="onUpdate"
    />
    <p v-if="error !== ''" class="m-0 text-xs text-destructive">
      {{ error }}
      <button
        type="button"
        class="ms-1 border-none bg-transparent p-0 text-destructive underline cursor-pointer"
        @click="reload"
      >
        重试
      </button>
    </p>
  </div>
</template>
