<script setup lang="ts">
import { colorFieldVariants } from '#ui/styles/color-field'
import { colorPickerVariants } from '#ui/styles/color-picker'
import { colorSwatchVariants } from '#ui/styles/color-swatch'
import { colorSwatchPickerVariants } from '#ui/styles/color-swatch-picker'
import { popoverVariants } from '#ui/styles/popover'
import { sliderVariants } from '#ui/styles/slider'
import { tabsVariants } from '#ui/styles/tabs'
import { provideColorAreaUi } from '@soybeanjs/headless/color-area'
import { provideColorFieldUi } from '@soybeanjs/headless/color-field'
import { ColorPickerCompact, provideColorPickerUi } from '@soybeanjs/headless/color-picker'
import { provideColorSliderUi } from '@soybeanjs/headless/color-slider'
import { provideColorSwatchUi } from '@soybeanjs/headless/color-swatch'
import { provideColorSwatchPickerUi } from '@soybeanjs/headless/color-swatch-picker'
import { useForwardListeners, useOmitProps } from '@soybeanjs/headless/composables'
import { providePopoverUi } from '@soybeanjs/headless/popover'
import { provideTabsUi } from '@soybeanjs/headless/tabs'
import { computed } from 'vue'

import type { ColorPickerProps, ColorPickerEmits } from './types'

defineOptions({
  name: 'SColorPicker',
})

const props = withDefaults(defineProps<ColorPickerProps>(), {
  open: undefined,
  showArrow: true,
  showAlpha: true,
  showFields: true,
  showSwatches: true,
})

const emit = defineEmits<ColorPickerEmits>()

const forwardedProps = useOmitProps(props, ['class', 'size', 'ui'])

const listeners = useForwardListeners(emit)

const ui = computed(() =>
  colorPickerVariants({ size: props.size }, props.ui, { trigger: props.class }),
)

provideColorPickerUi(ui)

// ColorPickerCompact composes other headless families; each keeps its own UI context.
providePopoverUi(
  computed(() => ({ ...popoverVariants({ size: props.size }), popup: ui.value.popup })),
)
provideColorAreaUi(
  computed(() => ({
    root: ui.value.areaRoot,
    area: ui.value.areaSurface,
    thumb: ui.value.areaThumb,
  })),
)
provideColorSliderUi(computed(() => sliderVariants({ size: props.size })))
provideColorFieldUi(computed(() => colorFieldVariants({ size: props.size })))
provideColorSwatchUi(computed(() => colorSwatchVariants({ size: props.size, shape: 'circle' })))
provideColorSwatchPickerUi(
  computed(() => colorSwatchPickerVariants({ size: props.size, shape: 'circle' })),
)
provideTabsUi(
  computed(() =>
    tabsVariants({
      size: props.size,
      orientation: 'horizontal',
      shape: 'square',
      fill: 'auto',
      enableIndicator: true,
    }),
  ),
)
</script>

<template>
  <ColorPickerCompact v-bind="forwardedProps" v-on="listeners" />
</template>
