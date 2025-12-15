import { useEffect, useMemo, useState } from 'react'
import { useCompany } from '../../contexts/CompanyContext'
import { contractsService } from '../../services/contractsService'
import type { ContractVersion, UUID } from '../../types'
import Card from '../ui/Card'
import Select from '../ui/Select'

export default function ContractVersions({ contractId }: { contractId: UUID }) {
  const { activeCompanyId } = useCompany()
  const [versions, setVersions] = useState<ContractVersion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leftId, setLeftId] = useState<string>('')
  const [rightId, setRightId] = useState<string>('')

  useEffect(() => {
    let canceled = false
    async function load() {
      if (!activeCompanyId) return
      setIsLoading(true)
      setError(null)
      try {
        const rows = await contractsService.listVersions(activeCompanyId, contractId)
        if (canceled) return
        setVersions(rows)
        setLeftId(rows[0]?.id ?? '')
        setRightId(rows[1]?.id ?? rows[0]?.id ?? '')
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Failed to load versions')
      } finally {
        if (!canceled) setIsLoading(false)
      }
    }
    load()
    return () => {
      canceled = true
    }
  }, [activeCompanyId, contractId])

  const left = useMemo(() => versions.find((v) => v.id === leftId) ?? null, [leftId, versions])
  const right = useMemo(() => versions.find((v) => v.id === rightId) ?? null, [rightId, versions])

  return (
    <Card className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Versions</div>
        <div className="text-xs text-slate-600">{isLoading ? 'Loading…' : `${versions.length} total`}</div>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Select
            ariaLabel="Left version"
            value={leftId}
            onChange={setLeftId}
            options={[
              { value: '', label: 'Select version…' },
              ...versions.map((v) => ({
                value: v.id,
                label: `v${v.version_number} • ${new Date(v.created_at).toLocaleString()}`
              }))
            ]}
          />
          <div className="rounded-md border bg-white p-3">
            <div className="text-xs text-slate-600">{left ? `v${left.version_number}` : '—'}</div>
            <div className="text-sm" dangerouslySetInnerHTML={{ __html: left?.content ?? '' }} />
          </div>
        </div>
        <div className="grid gap-2">
          <Select
            ariaLabel="Right version"
            value={rightId}
            onChange={setRightId}
            options={[
              { value: '', label: 'Select version…' },
              ...versions.map((v) => ({
                value: v.id,
                label: `v${v.version_number} • ${new Date(v.created_at).toLocaleString()}`
              }))
            ]}
          />
          <div className="rounded-md border bg-white p-3">
            <div className="text-xs text-slate-600">{right ? `v${right.version_number}` : '—'}</div>
            <div className="text-sm" dangerouslySetInnerHTML={{ __html: right?.content ?? '' }} />
          </div>
        </div>
      </div>
    </Card>
  )
}
