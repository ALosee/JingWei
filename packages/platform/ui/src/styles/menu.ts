// @unocss-include
import { scv } from '@soybeanjs/cva'

export const menuVariants = scv({
  slots: {
    positioner: '',
    popup: [
      'z-50 min-w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
    ],
    arrow: 'h-2 w-4 fill-popover stroke-border',
    subPositioner: '',
    subPopup: [
      'z-50 min-w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
    ],
    group: '',
    groupLabel: 'flex items-center px-2 py-1.5 text-xs font-medium text-muted-foreground',
    checkboxGroup: '',
    radioGroup: '',
    item: [
      'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 outline-none transition-colors-200',
      'focus:bg-accent focus:text-accent-foreground data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
      'data-[active=true]:bg-primary/10 data-[active=true]:text-primary',
    ],
    itemIcon: 'shrink-0 text-muted-foreground',
    itemLink: [
      'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 decoration-none outline-none transition-colors-200',
      'focus:bg-accent focus:text-accent-foreground data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
    ],
    itemLinkIcon: 'shrink-0 self-start text-muted-foreground rtl:rotate-270',
    subTrigger:
      'group/trigger flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 outline-none focus:bg-accent data-[state=open]:bg-accent data-[child-active]:text-primary',
    subTriggerIcon: 'ms-auto text-muted-foreground group-data-[child-active]/trigger:text-primary',
    shortcut: 'ms-auto tracking-widest opacity-60',
    separator: '-mx-1 my-1 h-px bg-border',
    checkboxItem:
      'relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 outline-none focus:bg-accent data-[disabled]:opacity-50',
    itemIndicator: 'absolute flex items-center justify-center text-primary',
    radioItem:
      'relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 outline-none focus:bg-accent data-[disabled]:opacity-50',
  },
  variants: {
    size: {
      xs: { popup: 'text-2xs', subPopup: 'text-2xs' },
      sm: { popup: 'text-xs', subPopup: 'text-xs' },
      md: { popup: 'text-sm', subPopup: 'text-sm' },
      lg: { popup: 'text-base', subPopup: 'text-base' },
      xl: { popup: 'text-lg', subPopup: 'text-lg' },
      '2xl': { popup: 'text-xl', subPopup: 'text-xl' },
    },
  },
  defaultVariants: { size: 'md' },
})
