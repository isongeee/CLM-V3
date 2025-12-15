import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { requireCompanyPermission, requireUser } from '../_shared/supabase.ts'

type Body = {
  company_id: string
  price_id: string
  success_url: string
  cancel_url: string
}

function formEncode(params: Record<string, string>) {
  return new URLSearchParams(params).toString()
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })

  const auth = await requireUser(req)
  if (!auth.ok) return jsonResponse(auth.status, { error: auth.error })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' })
  }

  if (!body.company_id || !body.price_id || !body.success_url || !body.cancel_url) {
    return jsonResponse(400, { error: 'Missing fields' })
  }
  const perm = await requireCompanyPermission(auth.user.id, body.company_id, 'org.manage')
  if (!perm.ok) return jsonResponse(perm.status, { error: perm.error })

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) return jsonResponse(500, { error: 'Missing STRIPE_SECRET_KEY' })

  const encoded = formEncode({
    mode: 'subscription',
    success_url: body.success_url,
    cancel_url: body.cancel_url,
    'line_items[0][price]': body.price_id,
    'line_items[0][quantity]': '1',
    'metadata[company_id]': body.company_id,
    'metadata[created_by]': auth.user.id
  })

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: encoded
  })

  const json = await res.json()
  if (!res.ok) return jsonResponse(500, { error: json?.error?.message ?? 'Stripe error', details: json })

  return jsonResponse(200, { ok: true, url: json.url, id: json.id })
})

