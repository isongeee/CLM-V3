import { useState } from 'react'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { useCompany } from '../contexts/CompanyContext'
import { companyService } from '../services/companyService'

export default function DashboardPage() {
  const { activeCompany, companies, refreshCompanies, setActiveCompanyId } = useCompany()
  const [newCompanyName, setNewCompanyName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="grid gap-4">
      <Card>
        <div className="text-sm text-slate-600">Active company</div>
        <div className="mt-1 text-lg font-semibold">{activeCompany?.name ?? '—'}</div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">Create company</h2>
          <form
            className="mt-3 grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              const name = newCompanyName.trim()
              if (!name) return
              try {
                const { id } = await companyService.createCompany({ name })
                await refreshCompanies()
                setActiveCompanyId(id)
                setNewCompanyName('')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create company')
              }
            }}
          >
            <Input label="Company name" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} />
            <Button type="submit">Create</Button>
          </form>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Join with invite code</h2>
          <form
            className="mt-3 grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              const code = inviteCode.trim()
              if (!code) return
              try {
                await companyService.joinByInviteCode(code)
                await refreshCompanies()
                setInviteCode('')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to join company')
              }
            }}
          >
            <Input label="Invite code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
            <Button type="submit" variant="secondary">
              Join
            </Button>
          </form>
        </Card>
      </div>
      {error ? (
        <Card>
          <div className="text-sm text-red-600">{error}</div>
        </Card>
      ) : null}
      <Card>
        <div className="text-sm text-slate-600">Your companies</div>
        <div className="mt-2 grid gap-2">
          {companies.length === 0 ? <div className="text-sm text-slate-700">No memberships yet.</div> : null}
          {companies.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="text-xs text-slate-600">
                  {c.membership.is_admin ? 'Admin' : 'Member'} • Invite code: {c.invite_code ?? '—'}
                </div>
              </div>
              <Button variant="ghost" onClick={() => setActiveCompanyId(c.id)}>
                Set active
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
