import type { ReactNode } from 'react'

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h1 className="text-lg font-semibold">{title}</h1>
      {actions}
    </div>
  )
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-3xl p-4">{children}</div>
}
