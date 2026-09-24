import { createTheme } from '@soybeanjs/theme'
import { computed, defineComponent, Fragment, h, useId } from 'vue'
import type { PropType } from 'vue'

import type { ConfigProviderThemeOptions } from '../../components/config-provider/types'

/** Render a theme inside an isolated CSS-variable scope without replacing the application theme. */
export const ThemeScope = defineComponent({
  name: 'ThemeScope',
  inheritAttrs: false,
  props: {
    theme: {
      type: Object as PropType<ConfigProviderThemeOptions>,
      required: true,
    },
    mode: {
      type: String as PropType<'light' | 'dark'>,
      default: 'light',
    },
  },
  setup(props, { attrs, slots }) {
    const id = useId()
    const selector = `[data-ui-theme-scope="${id}"]`
    const css = computed(() =>
      createTheme({
        ...props.theme,
        styleTarget: ':root',
        darkSelector: `${selector}[data-theme-mode="dark"]`,
      }).replaceAll(':root', selector),
    )

    return () =>
      h(Fragment, [
        h('style', {
          'data-ui-theme-scope-style': id,
          innerHTML: css.value,
        }),
        h(
          'div',
          {
            ...attrs,
            'data-ui-theme-scope': id,
            'data-theme-mode': props.mode,
          },
          slots.default?.(),
        ),
      ])
  },
})
