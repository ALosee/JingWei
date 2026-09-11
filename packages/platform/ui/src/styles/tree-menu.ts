// @unocss-include
import { scv } from '@soybeanjs/cva'

export const treeMenuVariants = scv({
  slots: {
    root: 'group flex h-full w-full flex-1 flex-col gap-1 overflow-auto p-2 text-sidebar-foreground transition-[width,height]-200 ease-out data-[state=collapsed]:w-[--soybean-tree-menu-collapsed-width]',
    groupRoot: 'mb-1 group-data-[state=collapsed]:mb-0',
    group: 'm-0 flex list-none flex-col gap-1 p-0',
    groupLabel:
      'h-8 flex items-center px-2 text-xs font-medium text-sidebar-foreground/70 transition-[height,padding,opacity]-200 group-data-[state=collapsed]:h-0 group-data-[state=collapsed]:overflow-hidden group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:opacity-0',
    item: 'relative m-0 p-0 group-data-[state=collapsed]:mx-auto group-data-[state=collapsed]:w-9 group-data-[state=collapsed]:hover:rounded-sm group-data-[state=collapsed]:hover:bg-sidebar-accent',
    button: [
      'group/button relative h-9 w-full flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 outline-none',
      'data-[active=true]:bg-sidebar-primary/10 data-[active=true]:text-sidebar-primary',
      'data-[active=false]:hover:bg-sidebar-accent data-[active=false]:focus:bg-sidebar-accent data-[child-active]:text-sidebar-primary',
      'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 group-data-[state=collapsed]:w-9 group-data-[state=collapsed]:overflow-hidden',
    ],
    collapsibleRoot: '',
    collapsibleTrigger: '',
    collapsibleContent:
      'overflow-hidden transition will-change-auto data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up',
    collapsibleIcon:
      'ms-auto shrink-0 text-muted-foreground transition-transform-200 group-data-[state=open]/button:rotate-90 group-data-[child-active]/button:text-sidebar-primary',
    sub: 'm-0 ms-[--soybean-tree-menu-indent] flex list-none flex-col gap-1 border-s border-sidebar-border border-solid ps-2 pt-1',
    itemLabel: 'truncate',
    itemLinkIcon: 'shrink-0 self-start text-muted-foreground rtl:rotate-270',
    itemTag:
      'ms-auto inline-flex shrink-0 items-center rounded-sm bg-sidebar-accent/15 px-1.5 text-sidebar-accent-foreground',
    itemAction:
      'absolute end-1.5 top-1/2 z-2 size-5 -translate-y-1/2 inline-flex items-center justify-center rounded-sm text-muted-foreground outline-none focus-visible:bg-sidebar-accent',
    itemAbsolute: 'absolute inset-0 z-1 cursor-pointer',
    tooltipPositioner: '',
    tooltipPopup:
      'z-50 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md',
    tooltipArrow: 'h-2 w-4 fill-popover stroke-border',
    badgeRoot: '',
    badgeContent: 'rounded-full bg-accent px-1.5 text-accent-foreground',
  },
  variants: {
    size: {
      xs: {
        root: 'text-2xs',
        item: 'group-data-[state=collapsed]:w-7',
        button: 'h-7 group-data-[state=collapsed]:w-7',
      },
      sm: {
        root: 'text-xs',
        item: 'group-data-[state=collapsed]:w-8',
        button: 'h-8 group-data-[state=collapsed]:w-8',
      },
      md: { root: 'text-sm' },
      lg: {
        root: 'text-base',
        item: 'group-data-[state=collapsed]:w-10',
        button: 'h-10 group-data-[state=collapsed]:w-10',
      },
      xl: {
        root: 'text-lg',
        item: 'group-data-[state=collapsed]:w-11',
        button: 'h-11 group-data-[state=collapsed]:w-11',
      },
      '2xl': {
        root: 'text-xl',
        item: 'group-data-[state=collapsed]:w-12',
        button: 'h-12 group-data-[state=collapsed]:w-12',
      },
    },
  },
  defaultVariants: { size: 'md' },
})
