// @unocss-include
import { scv } from '@soybeanjs/cva'

export const menubarVariants = scv({
  slots: {
    root: 'inline-flex w-fit items-center bg-transparent',
    trigger:
      'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 font-medium outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
  },
  variants: {
    size: {
      xs: { root: 'text-2xs', trigger: 'px-1 py-1' },
      sm: { root: 'text-xs', trigger: 'px-1.5 py-1' },
      md: { root: 'text-sm' },
      lg: { root: 'text-base', trigger: 'px-2.5' },
      xl: { root: 'text-lg', trigger: 'px-3 py-2' },
      '2xl': { root: 'text-xl', trigger: 'px-3.5 py-2.5' },
    },
    collapsible: { true: { root: 'min-w-max' }, false: {} },
  },
  defaultVariants: { size: 'md', collapsible: false },
})
