import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'outline' | 'destructive'
}

export function Badge({ className, variant = 'outline', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-accent text-accent-foreground',
        variant === 'outline' && 'border border-border text-muted-foreground',
        variant === 'destructive' && 'bg-destructive/10 text-destructive',
        className,
      )}
      {...props}
    />
  )
}
