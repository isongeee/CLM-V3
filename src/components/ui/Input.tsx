import type { InputHTMLAttributes } from 'react'
import clsx from 'clsx'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

export default function Input({ label, error, className, ...props }: Props) {
  return (
    <label className="grid gap-1 text-sm">
      {label ? <span className="text-slate-700">{label}</span> : null}
      <input
        {...props}
        className={clsx(
          'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400',
          error && 'border-red-400',
          className
        )}
      />
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  )
}

