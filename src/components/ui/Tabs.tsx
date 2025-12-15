import clsx from 'clsx'

export type TabKey = string

export default function Tabs({
  tabs,
  active,
  onChange
}: {
  tabs: { key: TabKey; label: string }[]
  active: TabKey
  onChange: (key: TabKey) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={clsx(
            'rounded-md px-3 py-2 text-sm',
            active === t.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

