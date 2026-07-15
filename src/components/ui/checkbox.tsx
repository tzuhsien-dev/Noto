import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export const Checkbox = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        // 20px visual, ~44px hit target via the ::after extension.
        'relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-input after:absolute after:-inset-3',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        'focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="h-3.5 w-3.5" aria-hidden />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})
