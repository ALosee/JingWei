// @unocss-include
import { cv } from '@soybeanjs/cva'

export type ButtonVariant = 'ghost' | 'outline' | 'soft' | 'solid'

export const buttonVariants = cv({
  base: [
    'inline-flex min-w-0 cursor-pointer items-center justify-center whitespace-nowrap font-medium transition-all-150',
    'rounded-md outline-none focus-visible:ring-3 focus-visible:ring-offset-background',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
  ],
  variants: {
    color: {
      primary: 'focus-visible:ring-primary/30',
      destructive: 'focus-visible:ring-destructive/30',
      success: 'focus-visible:ring-success/30',
      warning: 'focus-visible:ring-warning/30',
      info: 'focus-visible:ring-info/30',
      carbon: 'focus-visible:ring-carbon/30',
      secondary: 'focus-visible:ring-secondary-foreground/20',
      accent: 'focus-visible:ring-accent-foreground/20',
    },
    size: {
      xs: 'h-6 gap-1 px-1.5 text-2xs',
      sm: 'h-7 gap-2 px-2 text-xs',
      md: 'h-8 gap-3 px-4 text-sm',
      lg: 'h-9 gap-4 px-6 text-base',
      xl: 'h-10 gap-5 px-8 text-lg',
      '2xl': 'h-12 gap-6 px-10 text-xl',
    },
    variant: {
      solid: 'shadow-sm',
      outline: 'border bg-background',
      soft: '',
      ghost: 'bg-transparent',
    },
  },
  compoundVariants: [
    {
      color: 'primary',
      variant: 'solid',
      class:
        'bg-primary text-primary-foreground data-[normal]:hover:bg-primary/80 data-[normal]:active:bg-primary-600',
    },
    {
      color: 'primary',
      variant: ['outline', 'soft', 'ghost'],
      class: 'text-primary',
    },
    {
      color: 'destructive',
      variant: 'solid',
      class:
        'bg-destructive text-destructive-foreground data-[normal]:hover:bg-destructive/80 data-[normal]:active:bg-destructive-600',
    },
    {
      color: 'success',
      variant: 'solid',
      class:
        'bg-success text-success-foreground data-[normal]:hover:bg-success/80 data-[normal]:active:bg-success-600',
    },
    {
      color: 'warning',
      variant: 'solid',
      class:
        'bg-warning text-warning-foreground data-[normal]:hover:bg-warning/80 data-[normal]:active:bg-warning-600',
    },
    {
      color: 'info',
      variant: 'solid',
      class:
        'bg-info text-info-foreground data-[normal]:hover:bg-info/80 data-[normal]:active:bg-info-600',
    },
    {
      color: 'carbon',
      variant: 'solid',
      class:
        'bg-carbon text-carbon-foreground data-[normal]:hover:bg-carbon/80 data-[normal]:active:bg-carbon-600',
    },
    {
      color: 'secondary',
      variant: 'solid',
      class:
        'bg-secondary text-secondary-foreground data-[normal]:hover:bg-secondary/80 data-[normal]:active:bg-secondary-foreground/20',
    },
    {
      color: 'accent',
      variant: 'solid',
      class:
        'bg-accent text-accent-foreground data-[normal]:hover:bg-accent/80 data-[normal]:active:bg-accent-foreground/20',
    },
    {
      color: 'primary',
      variant: ['outline', 'ghost'],
      class: 'data-[normal]:hover:bg-primary/10 data-[normal]:active:bg-primary/20',
    },
    {
      color: 'destructive',
      variant: ['outline', 'soft', 'ghost'],
      class: 'text-destructive',
    },
    {
      color: 'success',
      variant: ['outline', 'soft', 'ghost'],
      class: 'text-success',
    },
    {
      color: 'warning',
      variant: ['outline', 'soft', 'ghost'],
      class: 'text-warning',
    },
    {
      color: 'info',
      variant: ['outline', 'soft', 'ghost'],
      class: 'text-info',
    },
    {
      color: 'carbon',
      variant: ['outline', 'soft', 'ghost'],
      class: 'text-carbon',
    },
    {
      color: 'secondary',
      variant: ['outline', 'soft', 'ghost'],
      class: 'text-secondary-foreground',
    },
    {
      color: 'accent',
      variant: ['outline', 'soft', 'ghost'],
      class: 'text-accent-foreground',
    },
    {
      color: 'destructive',
      variant: ['outline', 'ghost'],
      class: 'data-[normal]:hover:bg-destructive/10 data-[normal]:active:bg-destructive/20',
    },
    {
      color: 'success',
      variant: ['outline', 'ghost'],
      class: 'data-[normal]:hover:bg-success/10 data-[normal]:active:bg-success/20',
    },
    {
      color: 'warning',
      variant: ['outline', 'ghost'],
      class: 'data-[normal]:hover:bg-warning/10 data-[normal]:active:bg-warning/20',
    },
    {
      color: 'info',
      variant: ['outline', 'ghost'],
      class: 'data-[normal]:hover:bg-info/10 data-[normal]:active:bg-info/20',
    },
    {
      color: 'carbon',
      variant: ['outline', 'ghost'],
      class: 'data-[normal]:hover:bg-carbon/10 data-[normal]:active:bg-carbon/20',
    },
    {
      color: 'secondary',
      variant: ['outline', 'ghost'],
      class:
        'data-[normal]:hover:bg-secondary-foreground/10 data-[normal]:active:bg-secondary-foreground/20',
    },
    {
      color: 'accent',
      variant: ['outline', 'ghost'],
      class:
        'data-[normal]:hover:bg-accent-foreground/10 data-[normal]:active:bg-accent-foreground/20',
    },
    { color: 'primary', variant: 'outline', class: 'border-primary' },
    { color: 'destructive', variant: 'outline', class: 'border-destructive' },
    { color: 'success', variant: 'outline', class: 'border-success' },
    { color: 'warning', variant: 'outline', class: 'border-warning' },
    { color: 'info', variant: 'outline', class: 'border-info' },
    { color: 'carbon', variant: 'outline', class: 'border-carbon' },
    {
      color: 'secondary',
      variant: 'outline',
      class: 'border-secondary-foreground',
    },
    {
      color: 'accent',
      variant: 'outline',
      class: 'border-accent-foreground',
    },
    {
      color: 'primary',
      variant: 'soft',
      class: 'bg-primary/10 data-[normal]:hover:bg-primary/10 data-[normal]:active:bg-primary/20',
    },
    {
      color: 'destructive',
      variant: 'soft',
      class:
        'bg-destructive/10 data-[normal]:hover:bg-destructive/10 data-[normal]:active:bg-destructive/20',
    },
    {
      color: 'success',
      variant: 'soft',
      class: 'bg-success/10 data-[normal]:hover:bg-success/10 data-[normal]:active:bg-success/20',
    },
    {
      color: 'warning',
      variant: 'soft',
      class: 'bg-warning/10 data-[normal]:hover:bg-warning/10 data-[normal]:active:bg-warning/20',
    },
    {
      color: 'info',
      variant: 'soft',
      class: 'bg-info/10 data-[normal]:hover:bg-info/10 data-[normal]:active:bg-info/20',
    },
    {
      color: 'carbon',
      variant: 'soft',
      class: 'bg-carbon/10 data-[normal]:hover:bg-carbon/10 data-[normal]:active:bg-carbon/20',
    },
    {
      color: 'secondary',
      variant: 'soft',
      class:
        'bg-secondary-foreground/10 data-[normal]:hover:bg-secondary-foreground/10 data-[normal]:active:bg-secondary-foreground/20',
    },
    {
      color: 'accent',
      variant: 'soft',
      class:
        'bg-accent-foreground/10 data-[normal]:hover:bg-accent-foreground/10 data-[normal]:active:bg-accent-foreground/20',
    },
  ],
  defaultVariants: {
    color: 'primary',
    size: 'md',
    variant: 'solid',
  },
})
