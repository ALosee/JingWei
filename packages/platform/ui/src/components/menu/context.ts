import { menuVariants } from '#ui/styles/menu'
import { provideMenuUi as _provideMenuUi } from '@vean/aria/menu'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { MenuUiBaseProps } from './types'

export const provideMenuUi = (options: MaybeRefOrGetter<MenuUiBaseProps>) => {
  const ui = computed(() => {
    const props = toValue(options)

    return menuVariants(
      {
        size: props.size,
        indicatorPosition: props.indicatorPosition,
      },
      props.ui,
      { popup: props.class },
    )
  })

  _provideMenuUi(ui)
}
