import { useState } from 'react'
import { useCompany } from '../../contexts/CompanyContext'
import { supabase } from '../../lib/supabaseClient'
import type { UUID } from '../../types'
import Button from '../ui/Button'
import Card from '../ui/Card'

export default function ContractAiInsights({ contractId }: { contractId: UUID }) {
  const { activeCompanyId, can } = useCompany()
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  return (
    <Card className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">AI Insights (Gemini)</div>
        <Button
          variant="secondary"
          disabled={!can('ai.manage') || !activeCompanyId || isLoading}
          onClick={async () => {
            if (!activeCompanyId) return
            setIsLoading(true)
            setError(null)
            try {
              const { data, error: fnError } = await supabase.functions.invoke('analyze-contract', {
                body: { company_id: activeCompanyId, contract_id: contractId }
              })
              if (fnError) throw fnError
              setResult(data)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'AI request failed')
            } finally {
              setIsLoading(false)
            }
          }}
        >
          {isLoading ? 'Analyzing…' : 'Run analysis'}
        </Button>
      </div>

      <div className="text-xs text-slate-500">
        Analysis runs server-side via an Edge Function; no client API keys.
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {result ? (
        <pre className="overflow-auto rounded-md border bg-slate-950 p-3 text-xs text-slate-50">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : (
        <div className="text-sm text-slate-700">No analysis yet.</div>
      )}
    </Card>
  )
}

