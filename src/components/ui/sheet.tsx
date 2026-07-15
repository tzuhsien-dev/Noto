import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close
export const SheetTitle = DialogPrimitive.Title

/** Left-edge slide-in panel (mobile nav drawer). No built-in close button. */
export function SheetContent({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { children: ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in md:hidden" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-background shadow-xl',
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          'data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in md:hidden',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
