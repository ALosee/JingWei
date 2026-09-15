<script setup lang="ts" generic="T extends TreeItemData">
import { useForwardListeners } from '@soybeanjs/headless/composables'
import { TreeRoot } from '@soybeanjs/headless/tree'
import type { TreeItemData, TreeRootEmits, TreeRootProps } from '@soybeanjs/headless/tree'

import type { TreeSlots } from './types'

defineOptions({
  name: 'STree',
})

const props = withDefaults(defineProps<TreeRootProps<T>>(), {
  loop: true,
})

const emit = defineEmits<TreeRootEmits<TreeRootProps<T>['multiple']>>()

const listeners = useForwardListeners(emit)

defineSlots<TreeSlots<T>>()
</script>

<template>
  <TreeRoot
    v-slot="{ flattenItems, modelValue: rootModelValue, expanded: rootExpanded }"
    v-bind="props"
    v-on="listeners"
  >
    <slot name="top" />
    <template v-for="item in flattenItems" :key="item.value">
      <slot name="item" :item="item" :model-value="rootModelValue" :expanded="rootExpanded" />
    </template>
    <slot name="bottom" />
  </TreeRoot>
</template>
