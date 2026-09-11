// @unocss-include
import { scv } from '@soybeanjs/cva'

import { miniButtonIconVariants } from './button'

export const popoverVariants = scv({
  extendBase: (props) => ({ close: miniButtonIconVariants({ size: props.size }) }),
  slots: {
    positioner: 'w-max',
    popup: [
      'z-50 w-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md outline-none',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
    ],
    arrow: 'h-2 w-4 fill-popover stroke-border',
    close: 'absolute',
  },
  variants: {
    size: {
      xs: { popup: 'p-3 text-2xs', close: 'end-0.5 top-0.5' },
      sm: { popup: 'p-3.5 text-xs', close: 'end-0.75 top-0.75' },
      md: { popup: 'p-4 text-sm', close: 'end-1 top-1' },
      lg: { popup: 'p-4.5 text-base', close: 'end-1.25 top-1.25' },
      xl: { popup: 'p-5 text-lg', close: 'end-1.5 top-1.5' },
      '2xl': { popup: 'p-5.5 text-xl', close: 'end-2 top-2' },
    },
  },
  defaultVariants: { size: 'md' },
})
