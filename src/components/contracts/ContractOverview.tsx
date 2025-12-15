import { useState } from 'react'
import { useCompany } from '../../contexts/CompanyContext'
import { contractsService } from '../../services/contractsService'
import { signatureEnvelopeService } from '../../services/signatureEnvelopeService'
import type { Contract, ContractStatus, PermissionKey } from '../../types'
import Card from '../ui/Card'
import Input from '../ui/Input'
import Button from '../ui/Button'
import Select from '../ui/Select'

const statusOptions: { value: ContractStatus; label: string }[] = [
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

export default function ContractOverview({
  contract,
  onContractChange
}: {
  contract: Contract & { content: string | null }
  onContractChange: (next: Contract & { content: string | null }) => void
}) {
  const { activeCompanyId, can } = useCompany()
  const [error, setError] = useState<string | null>(null)
  const [signerEmail, setSignerEmail] = useState('')

  return (
    <Card className="grid gap-4">
      <div className="grid gap-1">
        <div className="text-sm text-slate-600">Status</div>
        <Select
          ariaLabel="Contract status"
          value={contract.status}
          onChange={async (v) => {
            if (!activeCompanyId) return
            setError(null)
            const next = v as ContractStatus
            if (next === 'sent_for_signature') {
              setError('Use "Send for signature" to create an envelope before transitioning.')
              return
            }
            const requiredPermission = requiredPermissionForStatus(next)
            if (!can(requiredPermission)) {
              setError(`Missing permission: ${requiredPermission}`)
              return
            }
            try {
              const updated = await contractsService.updateStatus(activeCompanyId, contract.id, next)
              onContractChange({ ...contract, status: updated.status, updated_at: updated.updated_at })
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to update status')
            }
          }}
          options={statusOptions}
        />
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Counterparty" value={contract.counterparty_name ?? '—'} />
        <Field label="Effective date" value={contract.effective_date ?? '—'} />
        <Field label="End date" value={contract.end_date ?? '—'} />
        <Field label="Total value" value={formatValue(contract.total_value, contract.currency)} />
      </div>

      <div className="grid gap-2">
        <div className="text-sm text-slate-600">Signature (internal MVP)</div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <Input
            label="Signer email"
            placeholder="signer@company.com"
            value={signerEmail}
            onChange={(e) => setSignerEmail(e.target.value)}
          />
          <Button
            disabled={!activeCompanyId || !can('contracts.send_for_signature')}
            onClick={async () => {
              if (!activeCompanyId) return
              setError(null)
              const email = signerEmail.trim().toLowerCase()
              if (!email) {
                setError('Signer email is required')
                return
              }
              try {
                await signatureEnvelopeService.createInternalEnvelope(activeCompanyId, contract.id, [{ email }])
                await contractsService.updateStatus(activeCompanyId, contract.id, 'sent_for_signature')
                onContractChange({ ...contract, status: 'sent_for_signature' })
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to create envelope')
              }
            }}
          >
            Send for signature
          </Button>
        </div>
        <div className="text-xs text-slate-500">
          Creates `signature_envelopes` + `signature_recipients`; events are written server-side.
        </div>
      </div>
    </Card>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  )
}

function formatValue(value: number | null, currency: string | null) {
  if (value == null) return '—'
  return `${value.toLocaleString()} ${currency ?? ''}`.trim()
}

function requiredPermissionForStatus(next: ContractStatus): PermissionKey {
  if (next === 'sent_for_signature') return 'contracts.send_for_signature'
  if (next === 'pending_approval') return 'contracts.approve'
  return 'contracts.update'
}
