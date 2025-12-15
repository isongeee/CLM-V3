import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { useCompany } from '../contexts/CompanyContext'
import { signatureService, type SignatureTask } from '../services/signatureService'

export default function SigningHubPage() {
  const { activeCompanyId } = useCompany()
  const [tasks, setTasks] = useState<SignatureTask[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let canceled = false
    async function load() {
      if (!activeCompanyId) return
      setIsLoading(true)
      setError(null)
      try {
        const rows = await signatureService.listMyTasks(activeCompanyId)
        if (!canceled) setTasks(rows)
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Failed to load signature tasks')
      } finally {
        if (!canceled) setIsLoading(false)
      }
    }
    load()
    return () => {
      canceled = true
    }
  }, [activeCompanyId])

  return (
    <div className="grid gap-4">
      <Card>
        <div className="text-sm font-semibold">Signing tasks</div>
        <div className="mt-1 text-sm text-slate-600">Internal provider MVP.</div>
      </Card>

      {error ? (
        <Card>
          <div className="text-sm text-red-600">{error}</div>
        </Card>
      ) : null}

      <Card className="grid gap-2">
        {isLoading ? <div className="text-sm text-slate-700">Loading…</div> : null}
        {tasks.length === 0 && !isLoading ? <div className="text-sm text-slate-700">No tasks.</div> : null}
        {tasks.map((t) => (
          <div key={t.recipient_id} className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                Envelope {t.envelope_id} • {t.envelope_status}
              </div>
              <div className="text-xs text-slate-600">
                Recipient status: {t.recipient_status} • Created: {new Date(t.created_at).toLocaleString()}
              </div>
              <Link className="text-xs underline" to={`/app/contracts/${t.contract_id}`}>
                View contract
              </Link>
            </div>
            <Button
              onClick={async () => {
                if (!activeCompanyId) return
                setError(null)
                try {
                  await signatureService.sign(activeCompanyId, t.envelope_id)
                  setTasks((prev) => prev.filter((x) => x.recipient_id !== t.recipient_id))
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed to sign')
                }
              }}
            >
              Sign
            </Button>
          </div>
        ))}
      </Card>
    </div>
  )
}

