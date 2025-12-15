import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase.ts'
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno'

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!stripeKey || !webhookSecret) return jsonResponse(500, { error: 'Missing Stripe env vars' })

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
  const signature = req.headers.get('stripe-signature')
  if (!signature) return jsonResponse(400, { error: 'Missing stripe-signature' })

  const rawBody = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (e) {
    return jsonResponse(400, { error: `Webhook signature error: ${(e as Error).message}` })
  }

  const supabase = getAdminClient()

  async function upsertBilling(companyId: string, value: any) {
    const { error } = await supabase.from('company_settings').upsert(
      { company_id: companyId, key: 'billing.subscription', value },
      { onConflict: 'company_id,key' }
    )
    if (error) throw error
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const companyId = (session.metadata?.company_id as string | undefined) ?? null
      if (companyId) {
        await upsertBilling(companyId, {
          status: 'active',
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          updated_at: new Date().toISOString()
        })
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      const companyId = (sub.metadata?.company_id as string | undefined) ?? null
      if (companyId) {
        await upsertBilling(companyId, {
          status: sub.status,
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          updated_at: new Date().toISOString()
        })
      }
    }
  } catch (e) {
    return jsonResponse(500, { error: (e as Error).message })
  }

  return jsonResponse(200, { ok: true })
})

