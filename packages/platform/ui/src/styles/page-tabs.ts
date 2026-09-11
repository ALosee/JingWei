// @unocss-include
import { scv } from '@soybeanjs/cva'
import type { VariantProps } from '@soybeanjs/cva'

export const pageTabsVariants = scv({
  slots: {
    root: 'flex',
    item: [
      'group/item relative flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 outline-none',
      'data-[active=true]:z-2 data-[active=true]:bg-primary-50 data-[active=true]:text-primary',
      'data-[active=false]:hover:bg-accent data-[active=false]:focus:bg-accent',
      'dark:data-[active=true]:bg-accent dark:data-[active=true]:text-foreground',
    ],
    itemText: 'max-w-60 grow truncate',
    close: 'rounded-full outline-none hover:bg-accent-foreground/20',
    pin: 'outline-none',
    chromeBgLeft: [
      'absolute end-full bottom-0 h-2 w-2 fill-transparent',
      'group-hover/item:fill-accent group-data-[active=true]/item:z-2 group-data-[active=true]/item:fill-primary-50 dark:group-data-[active=true]/item:fill-accent',
    ],
    chromeBgRight: [
      'absolute start-full bottom-0 h-2 w-2 fill-transparent',
      'group-hover/item:fill-accent group-data-[active=true]/item:z-2 group-data-[active=true]/item:fill-primary-50 dark:group-data-[active=true]/item:fill-accent',
    ],
    sliderIndicator:
      'absolute bottom-0 start-0 h-0.5 w-full group-data-[active=true]/item:bg-primary',
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
    variant: {
      chrome: { root: 'items-end', item: 'rounded-t-md' },
      card: { root: 'items-center gap-2', item: 'rounded-md border border-border shadow-sm' },
      slider: { root: 'items-end', item: 'rounded-t-md' },
    },
  },
  defaultVariants: { size: 'md', variant: 'chrome' },
})

type PageTabsVariants = VariantProps<typeof pageTabsVariants>
export type PageTabsVariant = NonNullable<PageTabsVariants['variant']>
