// @unocss-include
import { cv } from '@soybeanjs/cva'

export type ButtonSize = 'lg' | 'md' | 'sm'
export type ButtonVariant = 'danger' | 'ghost' | 'outline' | 'primary' | 'secondary'

export const buttonVariants = cv({
  base: [
    'inline-flex min-w-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap',
    'rounded-md border border-transparent font-medium outline-none transition-colors duration-150',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
  ],
  variants: {
    size: {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-5 text-base',
    },
    variant: {
      primary: [
        'bg-primary text-on-primary shadow-sm',
        'data-[normal]:hover:bg-primary-hover data-[normal]:active:bg-primary-active',
      ],
      secondary: [
        'bg-subtle text-foreground',
        'data-[normal]:hover:bg-subtle-hover data-[normal]:active:bg-subtle-active',
      ],
      outline: [
        'border-border bg-surface text-foreground',
        'data-[normal]:hover:bg-subtle-hover data-[normal]:active:bg-subtle-active',
      ],
      ghost: [
        'bg-transparent text-foreground',
        'data-[normal]:hover:bg-subtle-hover data-[normal]:active:bg-subtle-active',
      ],
      danger: [
        'bg-danger text-on-danger shadow-sm',
        'data-[normal]:hover:bg-danger-hover data-[normal]:active:bg-danger-active',
      ],
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'primary',
  },
})
