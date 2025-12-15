import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import Card from '../components/ui/Card'
import Tabs, { type TabKey } from '../components/ui/Tabs'
import { useCompany } from '../contexts/CompanyContext'
import { contractsService } from '../services/contractsService'
import type { Contract } from '../types'
import ContractOverview from '../components/contracts/ContractOverview'
import ContractEditor from '../components/contracts/ContractEditor'
import ContractDocuments from '../components/contracts/ContractDocuments'
import ContractVersions from '../components/contracts/ContractVersions'
import ContractAiInsights from '../components/contracts/ContractAiInsights'
import ContractActivity from '../components/contracts/ContractActivity'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'editor', label: 'Editor' },
  { key: 'documents', label: 'Documents' },
  { key: 'versions', label: 'Versions' },
  { key: 'ai', label: 'AI Insights' },
  { key: 'activity', label: 'Activity' }
]

export default function ContractDetailPage() {
  const { contractId } = useParams()
  const { activeCompanyId } = useCompany()
  const [contract, setContract] = useState<(Contract & { content: string | null }) | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')

  const id = useMemo(() => (contractId ? (contractId as string) : null), [contractId])

  useEffect(() => {
    let canceled = false
    async function load() {
      if (!activeCompanyId || !id) return
      setIsLoading(true)
      setError(null)
      try {
        const c = await contractsService.getContract(activeCompanyId, id)
        if (!canceled) setContract(c)
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Failed to load contract')
      } finally {
        if (!canceled) setIsLoading(false)
      }
    }
    load()
    return () => {
      canceled = true
    }
  }, [activeCompanyId, id])

  if (isLoading) return null
  if (error) return <Card>{error}</Card>
  if (!contract || !activeCompanyId || !id) return <Card>Not found.</Card>

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{contract.title}</div>
            <div className="text-sm text-slate-600">{contract.counterparty_name ?? '—'}</div>
          </div>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>
      </Card>

      {tab === 'overview' ? <ContractOverview contract={contract} onContractChange={setContract} /> : null}
      {tab === 'editor' ? <ContractEditor contract={contract} onContractChange={setContract} /> : null}
      {tab === 'documents' ? <ContractDocuments contractId={id} /> : null}
      {tab === 'versions' ? <ContractVersions contractId={id} /> : null}
      {tab === 'ai' ? <ContractAiInsights contractId={id} /> : null}
      {tab === 'activity' ? <ContractActivity contractId={id} /> : null}
    </div>
  )
}

