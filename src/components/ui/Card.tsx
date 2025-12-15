import type { PropsWithChildren } from 'react'
import clsx from 'clsx'

export default function Card({
  children,
  className
}: PropsWithChildren<{
  className?: string
}>) {
  return <div className={clsx('rounded-lg border bg-white p-4 shadow-sm', className)}>{children}</div>
}

