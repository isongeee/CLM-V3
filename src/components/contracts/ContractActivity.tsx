import { useEffect, useState } from 'react'
import { useCompany } from '../../contexts/CompanyContext'
import { auditService, type AuditLogRow } from '../../services/auditService'
import type { UUID } from '../../types'
import Card from '../ui/Card'

export default function ContractActivity({ contractId }: { contractId: UUID }) {
  const { activeCompanyId, can } = useCompany()
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false
    async function load() {
      if (!activeCompanyId) return
      if (!can('audit.view')) return
      setError(null)
      try {
        const logs = await auditService.listForContract(activeCompanyId, contractId)
        if (!canceled) setRows(logs)
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Failed to load audit logs')
      }
    }
    load()
    return () => {
      canceled = true
    }
  }, [activeCompanyId, can, contractId])

  if (!can('audit.view')) {
    return (
      <Card>
        <div className="text-sm text-slate-700">Missing permission: audit.view</div>
      </Card>
    )
  }

  return (
    <Card className="grid gap-3">
      <div className="text-sm font-semibold">Activity</div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {rows.length === 0 ? <div className="text-sm text-slate-700">No activity yet.</div> : null}
      <div className="grid gap-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-md border px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{r.action}</div>
              <div className="text-xs text-slate-600">{new Date(r.created_at).toLocaleString()}</div>
            </div>
            <div className="text-xs text-slate-600">{r.actor_email ?? '—'}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

