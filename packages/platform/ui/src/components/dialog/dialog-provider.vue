<script setup lang="ts">
import { dialogVariants } from '#ui/styles/dialog'
import { DialogProvider, provideDialogUi } from '@soybeanjs/headless/dialog'
import { computed } from 'vue'

defineOptions({
  name: 'SDialogProvider',
})

const ui = computed(() => dialogVariants({ size: 'md' }))

provideDialogUi(ui)
</script>

<template>
  <DialogProvider />
</template>
