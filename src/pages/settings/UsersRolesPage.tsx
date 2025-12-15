import { useState } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import { useCompany } from '../../contexts/CompanyContext'
import { supabase } from '../../lib/supabaseClient'

export default function UsersRolesPage() {
  const { activeCompanyId } = useCompany()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  return (
    <Card className="grid gap-3">
      <div>
        <div className="text-sm font-semibold">Users & Roles</div>
        <div className="text-sm text-slate-600">Admin-add by email via Edge Function.</div>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!activeCompanyId) return
          setError(null)
          setOk(null)
          try {
            const { error: fnError } = await supabase.functions.invoke('invite-user', {
              body: { mode: 'admin_add_by_email', company_id: activeCompanyId, email }
            })
            if (fnError) throw fnError
            setOk('User added (or reactivated) successfully.')
            setEmail('')
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add user')
          }
        }}
      >
        <Input label="User email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex items-end">
          <Button type="submit">Add</Button>
        </div>
      </form>

      {ok ? <div className="text-sm text-emerald-700">{ok}</div> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </Card>
  )
}

