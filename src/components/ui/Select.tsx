import clsx from 'clsx'

type Option = { value: string; label: string }

export default function Select({
  value,
  onChange,
  options,
  ariaLabel
}: {
  value: string
  onChange: (nextValue: string) => void
  options: Option[]
  ariaLabel: string
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        'rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400'
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

