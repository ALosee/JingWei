<script setup lang="ts">
import { menuVariants } from '#ui/styles/menu'
import { menubarVariants } from '#ui/styles/menubar'
import { useForwardListeners, useOmitProps } from '@soybeanjs/headless/composables'
import { provideMenuUi } from '@soybeanjs/headless/menu'
import { MenubarCompact, provideMenubarUi } from '@soybeanjs/headless/menubar'
import { keysOf } from '@soybeanjs/utils'
import { computed } from 'vue'

import type { MenubarEmits, MenubarProps, MenubarSlots } from './types'

defineOptions({ name: 'SMenubar' })

const props = defineProps<MenubarProps<string>>()
const emit = defineEmits<MenubarEmits<string>>()
const slots = defineSlots<MenubarSlots<string>>()
const forwardedProps = useOmitProps(props, ['class', 'size', 'ui', 'indicatorPosition'])
const listeners = useForwardListeners(emit)
const slotNames = computed(() => keysOf(slots))
const ui = computed(() =>
  menubarVariants({ size: props.size, collapsible: props.collapsible }, props.ui, {
    root: props.class,
  }),
)
const menuUi = computed(() => menuVariants({ size: props.size }))

provideMenubarUi(ui)
provideMenuUi(menuUi)
</script>

<template>
  <MenubarCompact v-bind="forwardedProps" v-on="listeners">
    <template v-for="slotName in slotNames" :key="slotName" #[slotName]="slotProps">
      <!-- @vue-ignore Headless owns the discriminated slot props. -->
      <slot :name="slotName" v-bind="slotProps" />
    </template>
  </MenubarCompact>
</template>
