<script setup lang="ts">
import { progressProviderVariants } from '#ui/styles/progress'
import { ProgressProvider, provideProgressProviderUi } from '@soybeanjs/headless/progress'
import type { ProgressProviderProps } from '@soybeanjs/headless/progress'
import { computed } from 'vue'

defineOptions({
  name: 'SProgressProvider',
})

const props = defineProps<ProgressProviderProps>()

const ui = computed(() => progressProviderVariants())

provideProgressProviderUi(ui)
</script>

<template>
  <ProgressProvider v-bind="props" />
</template>
