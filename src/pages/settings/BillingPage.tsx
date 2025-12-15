import { useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import { useCompany } from '../../contexts/CompanyContext'
import { supabase } from '../../lib/supabaseClient'

export default function BillingPage() {
  const { activeCompanyId } = useCompany()
  const [priceId, setPriceId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const origin = useMemo(() => window.location.origin, [])

  return (
    <Card className="grid gap-3">
      <div>
        <div className="text-sm font-semibold">Billing</div>
        <div className="text-sm text-slate-600">Stripe Checkout via Edge Function.</div>
      </div>

      <Input label="Stripe Price ID" value={priceId} onChange={(e) => setPriceId(e.target.value)} />
      <Button
        onClick={async () => {
          if (!activeCompanyId) return
          setError(null)
          try {
            const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
              body: {
                company_id: activeCompanyId,
                price_id: priceId.trim(),
                success_url: `${origin}/app/settings/billing`,
                cancel_url: `${origin}/app/settings/billing`
              }
            })
            if (fnError) throw fnError
            if (!data?.url) throw new Error('Missing checkout URL')
            window.location.href = data.url
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Checkout failed')
          }
        }}
      >
        Start checkout
      </Button>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </Card>
  )
}

