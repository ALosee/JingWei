// @unocss-include
import { scv } from '@soybeanjs/cva'

export const breadcrumbVariants = scv({
  slots: {
    root: '',
    list: 'my-0 flex flex-nowrap items-center gap-2 overflow-hidden px-0 text-muted-foreground',
    item: 'inline-flex min-w-0 items-center gap-2 list-none',
    page: 'truncate font-normal text-foreground',
    separator: 'shrink-0 text-muted-foreground list-none',
    ellipsis: 'flex items-center justify-center',
    link: 'truncate rounded-sm decoration-none outline-none transition-colors-200 hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30',
  },
  variants: {
    size: {
      xs: { root: 'text-2xs' },
      sm: { root: 'text-xs' },
      md: { root: 'text-sm' },
      lg: { root: 'text-base' },
      xl: { root: 'text-lg' },
      '2xl': { root: 'text-xl' },
    },
  },
  defaultVariants: { size: 'md' },
})
