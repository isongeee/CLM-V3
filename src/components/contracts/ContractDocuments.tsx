import { useEffect, useState } from 'react'
import { useCompany } from '../../contexts/CompanyContext'
import { documentsService } from '../../services/documentsService'
import type { ContractDocument, UUID } from '../../types'
import Button from '../ui/Button'
import Card from '../ui/Card'

export default function ContractDocuments({ contractId }: { contractId: UUID }) {
  const { activeCompanyId, can } = useCompany()
  const [docs, setDocs] = useState<ContractDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false
    async function load() {
      if (!activeCompanyId) return
      setIsLoading(true)
      setError(null)
      try {
        const rows = await documentsService.list(activeCompanyId, contractId)
        if (!canceled) setDocs(rows)
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Failed to load documents')
      } finally {
        if (!canceled) setIsLoading(false)
      }
    }
    load()
    return () => {
      canceled = true
    }
  }, [activeCompanyId, contractId])

  return (
    <Card className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Documents</div>
        <label className="inline-flex items-center gap-2">
          <input
            type="file"
            className="hidden"
            disabled={!can('contracts.update')}
            onChange={async (e) => {
              if (!activeCompanyId) return
              const file = e.target.files?.[0]
              if (!file) return
              setError(null)
              try {
                const created = await documentsService.upload(activeCompanyId, contractId, file)
                setDocs((prev) => [created, ...prev])
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Upload failed')
              } finally {
                e.target.value = ''
              }
            }}
          />
          <Button variant="secondary" disabled={!can('contracts.update')}>
            Upload
          </Button>
        </label>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      {isLoading ? <div className="text-sm text-slate-700">Loading…</div> : null}
      {docs.length === 0 && !isLoading ? <div className="text-sm text-slate-700">No documents.</div> : null}

      <div className="grid gap-2">
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{d.file_name}</div>
              <div className="text-xs text-slate-600">{d.storage_path}</div>
            </div>
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  const url = await documentsService.createSignedDownloadUrl(d.storage_path, 60)
                  window.open(url, '_blank', 'noopener,noreferrer')
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Download failed')
                }
              }}
            >
              Download
            </Button>
          </div>
        ))}
      </div>

      <div className="text-xs text-slate-500">Bucket: `contracts` (private). Downloads use signed URLs.</div>
    </Card>
  )
}

