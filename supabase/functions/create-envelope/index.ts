import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient, requireCompanyPermission, requireUser } from '../_shared/supabase.ts'

type Body = {
  company_id: string
  contract_id: string
  recipients: { email: string; signing_order?: number }[]
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
  if (!body.company_id || !body.contract_id || !Array.isArray(body.recipients) || body.recipients.length === 0) {
    return jsonResponse(400, { error: 'Missing fields' })
  }

  const perm = await requireCompanyPermission(auth.user.id, body.company_id, 'contracts.send_for_signature')
  if (!perm.ok) return jsonResponse(perm.status, { error: perm.error })

  const supabase = getAdminClient()

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id,company_id')
    .eq('company_id', body.company_id)
    .eq('id', body.contract_id)
    .single()
  if (contractError) return jsonResponse(500, { error: contractError.message })

  const now = new Date().toISOString()

  const { data: envelope, error: envelopeError } = await supabase
    .from('signature_envelopes')
    .insert({
      company_id: body.company_id,
      contract_id: body.contract_id,
      provider: 'internal',
      status: 'pending_signature',
      created_by: auth.user.id,
      sent_at: now
    })
    .select('id')
    .single()
  if (envelopeError) return jsonResponse(500, { error: envelopeError.message })

  const emails = body.recipients.map((r) => r.email.trim().toLowerCase()).filter(Boolean)
  const { data: users, error: usersError } = await supabase.from('users').select('id,email').in('email', emails)
  if (usersError) return jsonResponse(500, { error: usersError.message })
  const usersByEmail = new Map((users ?? []).map((u: any) => [String(u.email).toLowerCase(), u.id]))

  const recipients = body.recipients.map((r, idx) => {
    const email = r.email.trim().toLowerCase()
    return {
      company_id: body.company_id,
      envelope_id: envelope.id,
      recipient_role: 'signer',
      signing_order: r.signing_order ?? idx + 1,
      email,
      user_id: usersByEmail.get(email) ?? null,
      status: 'pending'
    }
  })

  const { error: recipientsError } = await supabase.from('signature_recipients').insert(recipients)
  if (recipientsError) return jsonResponse(500, { error: recipientsError.message })

  const { error: eventError } = await supabase.from('signature_events').insert([
    {
      envelope_id: envelope.id,
      company_id: body.company_id,
      event_type: 'envelope.created',
      payload: { contract_id: contract.id }
    },
    {
      envelope_id: envelope.id,
      company_id: body.company_id,
      event_type: 'envelope.sent',
      payload: { sent_at: now }
    }
  ])
  if (eventError) return jsonResponse(500, { error: eventError.message })

  await supabase
    .from('contracts')
    .update({ signature_status: 'pending_signature' })
    .eq('company_id', body.company_id)
    .eq('id', body.contract_id)

  return jsonResponse(200, { ok: true, envelope_id: envelope.id })
})

