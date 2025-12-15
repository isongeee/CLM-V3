import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { useCompany } from '../contexts/CompanyContext'
import { contractsService } from '../services/contractsService'
import type { Contract, ContractStatus } from '../types'

const PAGE_SIZE = 20

const statusOptions: { value: ContractStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In review' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'sent_for_signature', label: 'Sent for signature' },
  { value: 'fully_executed', label: 'Fully executed' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'archived', label: 'Archived' }
]

export default function ContractsListPage() {
  const { activeCompanyId, can } = useCompany()
  const [status, setStatus] = useState<ContractStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [total, setTotal] = useState(0)
  const [newTitle, setNewTitle] = useState('')

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  useEffect(() => {
    let canceled = false
    async function load() {
      if (!activeCompanyId) return
      setIsLoading(true)
      setError(null)
      try {
        const { contracts: rows, total: count } = await contractsService.listContracts({
          companyId: activeCompanyId,
          page,
          pageSize: PAGE_SIZE,
          status,
          search
        })
        if (canceled) return
        setContracts(rows)
        setTotal(count)
      } catch (e) {
        if (canceled) return
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!canceled) setIsLoading(false)
      }
    }
    load()
    return () => {
      canceled = true
    }
  }, [activeCompanyId, page, search, status])

  return (
    <div className="grid gap-4">
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label="Search"
            placeholder="Title or counterparty…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="grid gap-1 text-sm">
            <span className="text-slate-700">Status</span>
            <Select
              ariaLabel="Status filter"
              value={status}
              onChange={(v) => setStatus(v as any)}
              options={statusOptions}
            />
          </div>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!activeCompanyId) return
            if (!can('contracts.create')) return
            const title = newTitle.trim()
            if (!title) return
            setError(null)
            try {
              const created = await contractsService.createContract(activeCompanyId, title)
              setNewTitle('')
              setContracts((prev) => [created, ...prev])
              setTotal((t) => t + 1)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to create contract')
            }
          }}
        >
          <Input label="New contract title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <Button type="submit" disabled={!can('contracts.create')}>
            Create
          </Button>
        </form>
      </Card>

      {error ? (
        <Card>
          <div className="text-sm text-red-600">{error}</div>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {isLoading ? 'Loading…' : `${total} contract${total === 1 ? '' : 's'}`}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Prev
            </Button>
            <div className="text-sm text-slate-700">
              Page {page} / {totalPages}
            </div>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {contracts.length === 0 && !isLoading ? <div className="text-sm text-slate-700">No contracts.</div> : null}
          {contracts.map((c) => (
            <Link
              key={c.id}
              to={`/app/contracts/${c.id}`}
              className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{c.title}</div>
                <div className="truncate text-xs text-slate-600">{c.counterparty_name ?? '—'}</div>
              </div>
              <Badge tone={statusTone(c.status)}>{c.status}</Badge>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}

function statusTone(status: ContractStatus) {
  switch (status) {
    case 'active':
    case 'fully_executed':
      return 'success'
    case 'pending_approval':
    case 'sent_for_signature':
    case 'in_review':
      return 'warning'
    case 'terminated':
    case 'expired':
      return 'danger'
    default:
      return 'neutral'
  }
}

